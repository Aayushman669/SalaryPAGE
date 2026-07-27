import { getAuthenticatedApiUser, logPaymentServerError } from "@/lib/api-auth";
import { randomUUID } from "node:crypto";
import {
  createRazorpayOrder,
  getRazorpayConfig,
} from "@/lib/razorpay-server";
import type { PaymentOrderRow } from "@/lib/razorpay-payment-ledger";
import { hasOnlyKeys, readJsonBody } from "@/lib/api-security";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CreateOrderBody = {
  plan?: unknown;
  idempotencyKey?: unknown;
};

type PlanRow = {
  id: string;
  name: string;
  slug: string;
  price: number | string;
  currency: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role_mode: string | null;
  profile_completed: boolean | null;
  moderation_status: string | null;
};

const purchasablePlanSlugs = new Set(["starter", "growth", "pro"]);

function isPaymentOrderRow(value: unknown): value is PaymentOrderRow {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "recruiter_id" in value &&
      "plan_id" in value &&
      "provider" in value &&
      "idempotency_key" in value &&
      "amount" in value &&
      "currency" in value &&
      "status" in value,
  );
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

function readCreateOrderBody(value: unknown): {
  plan: string;
  idempotencyKey: string;
} | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const body = value as CreateOrderBody;

  if (
    typeof body.plan !== "string" ||
    !purchasablePlanSlugs.has(body.plan) ||
    typeof body.idempotencyKey !== "string" ||
    !/^[a-zA-Z0-9_-]{16,128}$/.test(body.idempotencyKey)
  ) {
    return null;
  }

  return { plan: body.plan, idempotencyKey: body.idempotencyKey };
}

function checkoutResponse({
  config,
  order,
  plan,
  profile,
}: {
  config: ReturnType<typeof getRazorpayConfig> extends infer T
    ? Exclude<T, null>
    : never;
  order: PaymentOrderRow;
  plan: PlanRow;
  profile: ProfileRow;
}) {
  return {
    orderId: order.provider_order_id,
    amount: Math.round(Number(order.amount) * 100),
    currency: order.currency.trim(),
    plan: plan.slug,
    planName: plan.name,
    keyId: config.keyId,
    prefill: {
      name: profile.full_name ?? "",
      email: profile.email ?? "",
    },
  };
}

export async function POST(request: Request) {
  const throttled = rateLimitResponse(enforceRateLimit(request, {
    max: 10,
    scope: "api:payment:create-order",
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
      { error: parsedBody.reason === "too_large" ? "Request is too large." : "Invalid payment request." },
      { status: 400 },
    );
  }

  if (!hasOnlyKeys(parsedBody.data, ["plan", "idempotencyKey"])) {
    return Response.json({ error: "Invalid plan purchase request." }, { status: 400 });
  }

  const body = readCreateOrderBody(parsedBody.data);

  if (!body) {
    return Response.json({ error: "Invalid plan purchase request." }, { status: 400 });
  }

  const { supabase, user } = auth;
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role_mode, profile_completed, moderation_status")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as ProfileRow | null;

  if (profileError) {
    logPaymentServerError("[razorpay] recruiter profile lookup failed", profileError);
    return Response.json({ error: "We could not verify your account." }, { status: 500 });
  }

  if (!profile || profile.role_mode !== "recruiter" || !profile.profile_completed) {
    return Response.json(
      { error: "Only completed Recruiter accounts can purchase plans." },
      { status: 403 },
    );
  }

  if (profile.moderation_status === "suspended" || profile.moderation_status === "restricted") {
    return Response.json(
      { error: "Your account is temporarily restricted from purchasing recruiter plans." },
      { status: 403 },
    );
  }

  const { data: planData, error: planError } = await supabase
    .from("plans")
    .select("id, name, slug, price, currency")
    .eq("slug", body.plan)
    .eq("active", true)
    .maybeSingle();
  const plan = planData as PlanRow | null;

  if (planError) {
    logPaymentServerError("[razorpay] plan lookup failed", planError);
    return Response.json({ error: "We could not load that plan." }, { status: 500 });
  }

  const price = plan ? Number(plan.price) : NaN;
  const currency = plan?.currency?.trim() ?? "";

  if (!plan || !Number.isFinite(price) || price <= 0 || !/^[A-Z]{3}$/.test(currency)) {
    return Response.json({ error: "That plan is not available for purchase." }, { status: 400 });
  }

  const amount = Math.round(price * 100);
  const { data: existingData, error: existingError } = await supabase
    .from("payment_orders")
    .select("id, recruiter_id, plan_id, provider, provider_order_id, provider_payment_id, idempotency_key, amount, currency, status, created_at")
    .eq("recruiter_id", user.id)
    .eq("provider", "razorpay")
    .eq("idempotency_key", body.idempotencyKey)
    .maybeSingle();
  let order = isPaymentOrderRow(existingData) ? existingData : null;

  if (existingError && !isUniqueViolation(existingError)) {
    logPaymentServerError("[razorpay] payment order lookup failed", existingError);
    return Response.json({ error: "We could not prepare checkout." }, { status: 500 });
  }

  if (order && (order.plan_id !== plan.id || Number(order.amount) !== price || order.currency.trim() !== currency)) {
    return Response.json({ error: "This checkout request is no longer valid." }, { status: 409 });
  }

  if (order?.provider_order_id) {
    if (order.status === "paid") {
      return Response.json({ error: "This payment has already been completed." }, { status: 409 });
    }

    if (order.status !== "pending") {
      return Response.json(
        { error: "This checkout attempt has ended. Please start a new checkout." },
        { status: 409 },
      );
    }

    return Response.json(checkoutResponse({ config, order, plan, profile }));
  }

  if (order && order.status !== "pending") {
    return Response.json(
      { error: "This checkout attempt has ended. Please start a new checkout." },
      { status: 409 },
    );
  }

  if (!order) {
    const { data: insertedData, error: insertError } = await supabase
      .from("payment_orders")
      .insert({
        recruiter_id: user.id,
        plan_id: plan.id,
        provider: "razorpay",
        idempotency_key: body.idempotencyKey,
        amount: price,
        currency,
        status: "pending",
      })
      .select("id, recruiter_id, plan_id, provider, provider_order_id, provider_payment_id, idempotency_key, amount, currency, status, created_at")
      .maybeSingle();

    if (insertError && !isUniqueViolation(insertError)) {
      logPaymentServerError("[razorpay] payment order intent insert failed", insertError);
      return Response.json({ error: "We could not prepare checkout." }, { status: 500 });
    }

    order = isPaymentOrderRow(insertedData) ? insertedData : null;
  }

  if (!order) {
    return Response.json(
      { error: "Checkout is already being prepared. Please try again shortly." },
      { status: 409 },
    );
  }

  const claimToken = randomUUID();
  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_razorpay_order_creation",
    {
      p_claim_token: claimToken,
      p_payment_order_id: order.id,
    },
  );

  if (claimError) {
    logPaymentServerError("[razorpay] payment order claim failed", claimError);
    return Response.json(
      { error: "We could not prepare checkout. Please try again." },
      { status: 503 },
    );
  }

  if (claimed !== true) {
    const { data: currentOrderData } = await supabase
      .from("payment_orders")
      .select("id, recruiter_id, plan_id, provider, provider_order_id, provider_payment_id, idempotency_key, amount, currency, status, created_at")
      .eq("id", order.id)
      .eq("recruiter_id", user.id)
      .maybeSingle();
    const currentOrder = isPaymentOrderRow(currentOrderData)
      ? currentOrderData
      : null;

    if (currentOrder?.provider_order_id && currentOrder.status === "pending") {
      return Response.json(checkoutResponse({ config, order: currentOrder, plan, profile }));
    }

    return Response.json(
      { error: "Checkout is already being prepared. Please try again shortly." },
      { status: 409 },
    );
  }

  try {
    const providerOrder = await createRazorpayOrder({
      amount,
      currency,
      receipt: `jb_${order.id.replace(/-/g, "").slice(0, 32)}`,
      notes: {
        plan: plan.slug,
        recruiter_id: user.id,
        payment_order_id: order.id,
      },
      config,
    });

    const { data: released, error: releaseError } = await supabase.rpc(
      "release_razorpay_order_creation",
      {
        p_claim_token: claimToken,
        p_payment_order_id: order.id,
        p_provider_order_id: providerOrder.id,
      },
    );

    if (releaseError || released !== true) {
      const { error: cleanupError } = await supabase.rpc(
        "release_razorpay_order_creation",
        {
          p_claim_token: claimToken,
          p_payment_order_id: order.id,
          p_provider_order_id: null,
        },
      );

      if (cleanupError) {
        logPaymentServerError("[razorpay] payment order claim cleanup failed", cleanupError);
      }
      logPaymentServerError(
        "[razorpay] payment order persistence failed",
        releaseError ?? new Error("Payment order creation claim could not be released."),
      );
      return Response.json({ error: "We could not prepare checkout." }, { status: 500 });
    }

    order = { ...order, provider_order_id: providerOrder.id };
    return Response.json(checkoutResponse({ config, order, plan, profile }));
  } catch (error) {
    const { error: releaseError } = await supabase.rpc(
      "release_razorpay_order_creation",
      {
        p_claim_token: claimToken,
        p_payment_order_id: order.id,
        p_provider_order_id: null,
      },
    );

    if (releaseError) {
      logPaymentServerError("[razorpay] payment order claim cleanup failed", releaseError);
    }
    logPaymentServerError("[razorpay] provider order creation failed", error);
    return Response.json(
      { error: "Payment checkout is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
}
