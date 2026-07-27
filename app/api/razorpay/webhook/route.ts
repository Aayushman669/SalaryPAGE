import { logPaymentServerError } from "@/lib/api-auth";
import {
  recordCapturedPayment,
  recordFailedPayment,
  type PaymentOrderRow,
} from "@/lib/razorpay-payment-ledger";
import {
  fetchRazorpayOrder,
  getRazorpayConfig,
  hashWebhookBody,
  verifyWebhookSignature,
} from "@/lib/razorpay-server";
import { readRawRequestBody } from "@/lib/api-security";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RazorpayEntity = {
  id?: unknown;
  order_id?: unknown;
  amount?: unknown;
  currency?: unknown;
  status?: unknown;
};

type RazorpayWebhookPayload = {
  event?: unknown;
  payload?: {
    payment?: {
      entity?: RazorpayEntity;
    };
  };
};

function isSupportedEvent(event: unknown): event is "payment.captured" | "payment.failed" {
  return event === "payment.captured" || event === "payment.failed";
}

function readEntity(payload: RazorpayWebhookPayload) {
  const entity = payload.payload?.payment?.entity;

  if (!entity || typeof entity !== "object") {
    return null;
  }

  if (
    typeof entity.id !== "string" ||
    typeof entity.order_id !== "string" ||
    typeof entity.amount !== "number" ||
    typeof entity.currency !== "string"
  ) {
    return null;
  }

  return {
    id: entity.id,
    orderId: entity.order_id,
    amount: entity.amount,
    currency: entity.currency,
    status: typeof entity.status === "string" ? entity.status : "",
  };
}

async function markWebhookEvent(
  supabase: NonNullable<ReturnType<typeof import("@/lib/supabase-admin").createSupabaseAdminClient>>,
  eventId: string,
  status: "processed" | "failed",
  entity?: { orderId: string; id: string },
) {
  const { error } = await supabase
    .from("payment_webhook_events")
    .update({
      status,
      processed_at: status === "processed" ? new Date().toISOString() : null,
      provider_order_id: entity?.orderId ?? null,
      provider_payment_id: entity?.id ?? null,
    })
    .eq("provider", "razorpay")
    .eq("provider_event_id", eventId);

  if (error) {
    logPaymentServerError("[razorpay] webhook event update failed", error);
  }
}

export async function POST(request: Request) {
  const throttled = rateLimitResponse(enforceRateLimit(request, {
    max: 120,
    scope: "api:razorpay:webhook",
    windowMs: 60_000,
  }));

  if (throttled) {
    return throttled;
  }

  const config = getRazorpayConfig();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const eventId = request.headers.get("x-razorpay-event-id") ?? "";

  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    return Response.json({ error: "Invalid webhook content type." }, { status: 400 });
  }

  const rawBodyResult = await readRawRequestBody(request, 256 * 1024);

  if (!rawBodyResult.ok) {
    return Response.json(
      { error: rawBodyResult.reason === "too_large" ? "Webhook payload is too large." : "Invalid webhook payload." },
      { status: 400 },
    );
  }

  const rawBody = rawBodyResult.text;

  if (!config?.webhookSecret) {
    return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  if (!signature || !verifyWebhookSignature({ body: rawBody, signature, secret: config.webhookSecret })) {
    void recordSecurityEvent({
      eventType: "webhook_signature_failed",
      metadata: { provider: "razorpay" },
      severity: "warning",
    });
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let payload: RazorpayWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const event = typeof payload.event === "string" ? payload.event : "";
  const stableEventId = eventId || hashWebhookBody(rawBody);

  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(stableEventId)) {
    return Response.json({ error: "Invalid webhook event." }, { status: 400 });
  }

  const supabaseModule = await import("@/lib/supabase-admin");
  const supabase = supabaseModule.createSupabaseAdminClient();

  if (!supabase) {
    return Response.json({ error: "Webhook storage is not configured." }, { status: 503 });
  }

  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_razorpay_webhook_event",
    {
      p_event_type: event || "unknown",
      p_provider_event_id: stableEventId,
    },
  );

  if (claimError) {
    logPaymentServerError("[razorpay] webhook claim failed", claimError);
    void recordSecurityEvent({
      eventType: "webhook_processing_failed",
      metadata: { provider: "razorpay", reason: "claim_failed" },
      severity: "critical",
    });
    return Response.json({ error: "Webhook could not be processed." }, { status: 500 });
  }

  if (claimed !== true) {
    void recordSecurityEvent({
      eventType: "webhook_replay_detected",
      metadata: { provider: "razorpay" },
      severity: "warning",
    });
    return Response.json({ received: true, duplicate: true });
  }

  if (!isSupportedEvent(event)) {
    await markWebhookEvent(supabase, stableEventId, "processed");
    void recordSecurityEvent({
      eventType: "webhook_processed",
      metadata: { provider: "razorpay", outcome: "ignored_event" },
      severity: "info",
    });
    return Response.json({ received: true, ignored: true });
  }

  const entity = readEntity(payload);

  if (!entity) {
    await markWebhookEvent(supabase, stableEventId, "failed");
    void recordSecurityEvent({
      eventType: "webhook_processing_failed",
      metadata: { provider: "razorpay", reason: "invalid_payment_payload" },
      severity: "warning",
    });
    return Response.json({ error: "Invalid webhook payment payload." }, { status: 400 });
  }

  const { data: orderData, error: orderError } = await supabase
    .from("payment_orders")
    .select("id, recruiter_id, plan_id, provider, provider_order_id, provider_payment_id, idempotency_key, amount, currency, status, created_at")
    .eq("provider", "razorpay")
    .eq("provider_order_id", entity.orderId)
    .maybeSingle();
  const order = orderData as PaymentOrderRow | null;

  if (orderError) {
    await markWebhookEvent(supabase, stableEventId, "failed", entity);
    logPaymentServerError("[razorpay] webhook payment order lookup failed", orderError);
    void recordSecurityEvent({
      eventType: "webhook_processing_failed",
      metadata: { provider: "razorpay", reason: "order_lookup_failed" },
      severity: "critical",
    });
    return Response.json({ error: "Webhook could not be processed." }, { status: 500 });
  }

  if (!order) {
    await markWebhookEvent(supabase, stableEventId, "processed", entity);
    void recordSecurityEvent({
      eventType: "webhook_processed",
      metadata: { provider: "razorpay", outcome: "unknown_order" },
      severity: "warning",
    });
    return Response.json({ received: true, ignored: true });
  }

  const expectedAmount = Math.round(Number(order.amount) * 100);

  if (entity.amount !== expectedAmount || entity.currency.trim() !== order.currency.trim()) {
    await markWebhookEvent(supabase, stableEventId, "failed", entity);
    void recordSecurityEvent({
      eventType: "webhook_processing_failed",
      metadata: { provider: "razorpay", reason: "amount_or_currency_mismatch" },
      severity: "critical",
      targetId: order.id,
      targetType: "payment",
    });
    return Response.json({ received: true, ignored: true });
  }

  if (event === "payment.captured") {
    try {
      const providerOrder = await fetchRazorpayOrder(config, entity.orderId);

      if (providerOrder.status !== "paid") {
        await markWebhookEvent(supabase, stableEventId, "failed", entity);
        void recordSecurityEvent({
          eventType: "webhook_processing_failed",
          metadata: { provider: "razorpay", reason: "provider_order_not_paid" },
          severity: "warning",
          targetId: order.id,
          targetType: "payment",
        });
        return Response.json({ received: true, retry: true }, { status: 500 });
      }

      const result = await recordCapturedPayment({
        supabase,
        order,
        paymentId: entity.id,
        amount: entity.amount,
        currency: entity.currency,
      });

      if (!result.ok) {
        await markWebhookEvent(supabase, stableEventId, "failed", entity);
        void recordSecurityEvent({
          eventType: "subscription_activation_failed",
          metadata: { provider: "razorpay", duplicate: false },
          severity: "critical",
          targetId: order.id,
          targetType: "payment",
        });
        return Response.json({ error: "Webhook could not be processed." }, { status: 500 });
      }
    } catch (error) {
      await markWebhookEvent(supabase, stableEventId, "failed", entity);
      logPaymentServerError("[razorpay] captured webhook processing failed", error);
      void recordSecurityEvent({
        eventType: "webhook_processing_failed",
        metadata: { provider: "razorpay", reason: "capture_processing_failed" },
        severity: "critical",
        targetId: order.id,
        targetType: "payment",
      });
      return Response.json({ error: "Webhook could not be processed." }, { status: 500 });
    }
  } else {
    const recorded = await recordFailedPayment({
      supabase,
      order,
      paymentId: entity.id,
      amount: entity.amount,
      currency: entity.currency,
    });

    if (!recorded) {
      await markWebhookEvent(supabase, stableEventId, "failed", entity);
      void recordSecurityEvent({
        eventType: "webhook_processing_failed",
        metadata: { provider: "razorpay", reason: "failed_payment_recording" },
        severity: "critical",
        targetId: order.id,
        targetType: "payment",
      });
      return Response.json({ error: "Webhook could not be processed." }, { status: 500 });
    }
  }

  await markWebhookEvent(supabase, stableEventId, "processed", entity);
  void recordSecurityEvent({
    eventType: "webhook_processed",
    metadata: { provider: "razorpay", outcome: "payment_state_recorded" },
    severity: "info",
    targetId: order.id,
    targetType: "payment",
  });
  return Response.json({ received: true });
}
