import { getAuthenticatedApiUser, logPaymentServerError } from "@/lib/api-auth";
import {
  recordCapturedPayment,
  type PaymentOrderRow,
} from "@/lib/razorpay-payment-ledger";
import {
  fetchRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayConfig,
  verifyCheckoutSignature,
} from "@/lib/razorpay-server";
import { hasOnlyKeys, readJsonBody } from "@/lib/api-security";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type VerifyPaymentBody = {
  orderId?: unknown;
  paymentId?: unknown;
  signature?: unknown;
};

function readVerifyBody(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const body = value as VerifyPaymentBody;

  if (
    typeof body.orderId !== "string" ||
    typeof body.paymentId !== "string" ||
    typeof body.signature !== "string" ||
    !/^order_[A-Za-z0-9]+$/.test(body.orderId) ||
    !/^pay_[A-Za-z0-9]+$/.test(body.paymentId) ||
    !/^[a-f0-9]{64}$/i.test(body.signature)
  ) {
    return null;
  }

  return {
    orderId: body.orderId,
    paymentId: body.paymentId,
    signature: body.signature,
  };
}

export async function POST(request: Request) {
  const throttled = rateLimitResponse(enforceRateLimit(request, {
    max: 20,
    scope: "api:payment:verify",
    windowMs: 60_000,
  }));

  if (throttled) return throttled;

  const auth = await getAuthenticatedApiUser(request);

  if (!auth) {
    return Response.json({ error: "Please log in to continue." }, { status: 401 });
  }

  const config = getRazorpayConfig();

  if (!config) {
    return Response.json(
      { error: "Payment service is not configured yet." },
      { status: 503 },
    );
  }

  const parsedBody = await readJsonBody(request, 16 * 1024);
  if (!parsedBody.ok) {
    return Response.json(
      { error: parsedBody.reason === "too_large" ? "Request is too large." : "Invalid payment response." },
      { status: 400 },
    );
  }

  if (!hasOnlyKeys(parsedBody.data, ["orderId", "paymentId", "signature"])) {
    return Response.json({ error: "Invalid payment response." }, { status: 400 });
  }

  const body = readVerifyBody(parsedBody.data);

  if (!body) {
    return Response.json({ error: "Invalid payment response." }, { status: 400 });
  }

  const { supabase, user } = auth;
  const { data: orderData, error: orderError } = await supabase
    .from("payment_orders")
    .select("id, recruiter_id, plan_id, provider, provider_order_id, provider_payment_id, idempotency_key, amount, currency, status, created_at")
    .eq("provider", "razorpay")
    .eq("provider_order_id", body.orderId)
    .eq("recruiter_id", user.id)
    .maybeSingle();
  const order = orderData as PaymentOrderRow | null;

  if (orderError) {
    logPaymentServerError("[razorpay] payment order verification lookup failed", orderError);
    return Response.json({ error: "We could not verify this payment." }, { status: 500 });
  }

  if (!order) {
    return Response.json({ error: "This payment order is not valid." }, { status: 400 });
  }

  if (
    !verifyCheckoutSignature({
      orderId: order.provider_order_id ?? body.orderId,
      paymentId: body.paymentId,
      signature: body.signature,
      secret: config.keySecret,
    })
  ) {
    void recordSecurityEvent({
      actorId: user.id,
      eventType: "payment_verification_failed",
      metadata: { reason: "invalid_checkout_signature" },
      severity: "warning",
      targetId: order.id,
      targetType: "payment",
    });
    return Response.json({ error: "Payment verification failed." }, { status: 400 });
  }

  if (order.status === "paid" && order.provider_payment_id === body.paymentId) {
    void recordSecurityEvent({
      actorId: user.id,
      eventType: "payment_verification_succeeded",
      metadata: { duplicate: true },
      severity: "info",
      targetId: order.id,
      targetType: "payment",
    });
    return Response.json({
      verified: true,
      duplicate: true,
      subscriptionActivated: true,
    });
  }

  if (order.status === "paid") {
    return Response.json({ error: "This payment order has already been completed." }, { status: 409 });
  }

  try {
    const [payment, providerOrder] = await Promise.all([
      fetchRazorpayPayment(config, body.paymentId),
      fetchRazorpayOrder(config, body.orderId),
    ]);
    const expectedAmount = Math.round(Number(order.amount) * 100);
    const expectedCurrency = order.currency.trim();

    if (
      payment.id !== body.paymentId ||
      payment.order_id !== body.orderId ||
      payment.amount !== expectedAmount ||
      payment.currency.trim() !== expectedCurrency ||
      providerOrder.id !== body.orderId ||
      providerOrder.amount !== expectedAmount ||
      providerOrder.currency.trim() !== expectedCurrency
    ) {
      void recordSecurityEvent({
        actorId: user.id,
        eventType: "payment_verification_failed",
        metadata: { reason: "provider_details_mismatch" },
        severity: "warning",
        targetId: order.id,
        targetType: "payment",
      });
      return Response.json({ error: "Payment details could not be verified." }, { status: 400 });
    }

    if (payment.status !== "captured" || providerOrder.status !== "paid") {
      void recordSecurityEvent({
        actorId: user.id,
        eventType: "payment_verification_failed",
        metadata: { reason: "payment_not_captured" },
        severity: "warning",
        targetId: order.id,
        targetType: "payment",
      });
      return Response.json(
        { error: "Payment received but is still being confirmed. Please check again shortly." },
        { status: 409 },
      );
    }

    const result = await recordCapturedPayment({
      supabase,
      order,
      paymentId: body.paymentId,
      amount: payment.amount,
      currency: payment.currency,
    });

    if (!result.ok) {
      void recordSecurityEvent({
        actorId: user.id,
        eventType: "subscription_activation_failed",
        metadata: { duplicate: false },
        severity: "critical",
        targetId: order.id,
        targetType: "payment",
      });
      return Response.json({ error: result.error }, { status: 500 });
    }

    void recordSecurityEvent({
      actorId: user.id,
      eventType: "payment_verification_succeeded",
      metadata: { duplicate: result.duplicate },
      severity: "info",
      targetId: order.id,
      targetType: "payment",
    });

    return Response.json({
      verified: true,
      duplicate: result.duplicate,
      subscriptionActivated: true,
      subscription: result.activation,
    });
  } catch (error) {
    logPaymentServerError("[razorpay] payment status verification failed", error);
    void recordSecurityEvent({
      actorId: user.id,
      eventType: "payment_verification_failed",
      metadata: { reason: "provider_request_failed" },
      severity: "warning",
      targetId: order.id,
      targetType: "payment",
    });
    return Response.json(
      { error: "We could not confirm the payment right now. Please try again." },
      { status: 502 },
    );
  }
}
