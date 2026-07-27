import {
  getAuthenticatedApiUserClient,
  logPaymentServerError,
} from "@/lib/api-auth";
import {
  mapBillingPaymentStatus,
  type BillingCurrentPlan,
  type BillingPurchaseRecord,
} from "@/lib/billing";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProfileRow = {
  full_name: string | null;
  role_mode: string | null;
};

type PlanRow = {
  active: boolean;
  billing_type: string;
  currency: string;
  duration_days: number | null;
  featured_job_limit: number | null;
  id: string;
  job_post_limit: number | null;
  name: string;
  price: number | string;
  slug: string;
};

type PurchaseRow = {
  amount: number | string;
  currency: string;
  id: string;
  payment_provider: string | null;
  payment_reference: string | null;
  plan_id: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  purchased_at: string;
  status: string;
  subscription_id: string | null;
};

type SubscriptionRow = {
  expires_at: string | null;
  id: string;
  payment_id: string | null;
  plan_id: string;
  purchased_at: string | null;
  starts_at: string | null;
  status: string;
};

type UsageRow = {
  featured_jobs_used: number | string | null;
  jobs_posted: number | string | null;
  remaining_jobs: number | string | null;
};

type CurrentPurchaseRow = {
  amount: number | string;
  currency: string;
  purchased_at: string;
};

const pageSize = 10;
const acceptedStatuses = new Set([
  "pending",
  "paid",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
  "cancelled",
]);

function finiteNumber(value: unknown, fallback = 0) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseDateFilter(value: string | null) {
  if (!value) {
    return { value: null, error: null };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { value: null, error: "Use a valid date filter." };
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime())
    ? { value: null, error: "Use a valid date filter." }
    : { value: date.toISOString(), error: null };
}

function safeSearch(value: string | null) {
  return (value ?? "").replace(/[^a-zA-Z0-9._@ -]/g, "").trim().slice(0, 80);
}

function asLimit(value: number | null) {
  return value === null ? "unlimited" : Math.max(0, value);
}

function mapCurrentPlan(
  plan: PlanRow,
  subscription: SubscriptionRow,
  usage: UsageRow | null,
  purchase: CurrentPurchaseRow | null,
): BillingCurrentPlan {
  const status =
    subscription.status === "active" &&
    subscription.expires_at &&
    new Date(subscription.expires_at).getTime() <= Date.now()
      ? "expired"
      : subscription.status;
  const jobsPosted = Math.max(0, Math.round(finiteNumber(usage?.jobs_posted)));
  const featuredJobsUsed = Math.max(
    0,
    Math.round(finiteNumber(usage?.featured_jobs_used)),
  );
  const jobPostLimit = asLimit(plan.job_post_limit);
  const featuredJobLimit = asLimit(plan.featured_job_limit);
  const storedRemainingJobs =
    usage?.remaining_jobs === null || usage?.remaining_jobs === undefined
      ? null
      : Math.max(0, Math.round(finiteNumber(usage.remaining_jobs)));

  return {
    amount: Math.max(0, finiteNumber(purchase?.amount ?? plan.price)),
    billingType: plan.billing_type,
    currency: purchase?.currency?.trim() || plan.currency.trim(),
    expiresAt: subscription.expires_at,
    featuredJobLimit,
    featuredJobsUsed,
    isActive: status === "active" || status === "lifetime",
    jobPostLimit,
    jobsPosted,
    planId: plan.id,
    planName: plan.name,
    planSlug: plan.slug,
    purchasedAt: purchase?.purchased_at ?? subscription.purchased_at,
    remainingFeaturedJobs:
      featuredJobLimit === "unlimited"
        ? "unlimited"
        : Math.max(0, featuredJobLimit - featuredJobsUsed),
    remainingJobs:
      jobPostLimit === "unlimited"
        ? "unlimited"
        : storedRemainingJobs ?? Math.max(0, jobPostLimit - jobsPosted),
    startsAt: subscription.starts_at,
    status,
    subscriptionId: subscription.id,
    usageAvailable: Boolean(usage),
  };
}

export async function GET(request: Request) {
  const throttled = rateLimitResponse(enforceRateLimit(request, {
    max: 60,
    scope: "api:billing:read",
    windowMs: 60_000,
  }));

  if (throttled) return throttled;

  const auth = await getAuthenticatedApiUserClient(request);

  if (!auth) {
    return Response.json({ error: "Please log in to continue." }, { status: 401 });
  }

  const { supabase, user } = auth;
  const profileResult = await supabase
    .from("profiles")
    .select("full_name, role_mode")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileResult.data as ProfileRow | null;

  if (profileResult.error) {
    logPaymentServerError("[billing] profile lookup failed", profileResult.error);
    return Response.json({ error: "We could not load billing data." }, { status: 500 });
  }

  if (!profile || profile.role_mode !== "recruiter") {
    return Response.json(
      { error: "Billing is available only for Recruiter accounts." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const page = Math.min(
    10000,
    Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1),
  );
  const status = url.searchParams.get("status") ?? "";
  const planSlug = url.searchParams.get("plan") ?? "";
  const search = safeSearch(url.searchParams.get("search"));
  const fromDate = parseDateFilter(url.searchParams.get("from"));
  const toDate = parseDateFilter(url.searchParams.get("to"));

  if (status && !acceptedStatuses.has(status)) {
    return Response.json({ error: "Invalid payment status filter." }, { status: 400 });
  }

  if (fromDate.error || toDate.error) {
    return Response.json({ error: "Use valid date filters." }, { status: 400 });
  }

  if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
    return Response.json({ error: "The start date must be before the end date." }, { status: 400 });
  }

  let planFilterId: string | null = null;

  if (planSlug) {
    const planResult = await supabase
      .from("plans")
      .select("id")
      .eq("slug", planSlug)
      .maybeSingle();

    if (planResult.error) {
      logPaymentServerError("[billing] plan filter lookup failed", planResult.error);
      return Response.json({ error: "We could not apply that plan filter." }, { status: 500 });
    }

    if (!planResult.data) {
      return Response.json({
        availablePlans: [],
        currentPlan: null,
        recruiterName: profile.full_name ?? "Recruiter",
        purchases: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
      });
    }

    planFilterId = (planResult.data as { id: string }).id;
  }

  const rangeStart = (page - 1) * pageSize;
  let purchasesQuery = supabase
    .from("purchase_history")
    .select(
      "id, plan_id, subscription_id, amount, currency, payment_provider, payment_reference, provider_order_id, provider_payment_id, status, purchased_at",
      { count: "exact" },
    )
    .eq("recruiter_id", user.id)
    .order("purchased_at", { ascending: false })
    .order("id", { ascending: false })
    .range(rangeStart, rangeStart + pageSize - 1);

  if (status) {
    purchasesQuery = purchasesQuery.eq("status", status);
  }

  if (planFilterId) {
    purchasesQuery = purchasesQuery.eq("plan_id", planFilterId);
  }

  if (fromDate.value) {
    purchasesQuery = purchasesQuery.gte("purchased_at", fromDate.value);
  }

  if (toDate.value) {
    purchasesQuery = purchasesQuery.lt(
      "purchased_at",
      new Date(new Date(toDate.value).getTime() + 86_400_000).toISOString(),
    );
  }

  if (search) {
    purchasesQuery = purchasesQuery.or(
      `payment_reference.ilike.%${search}%,provider_payment_id.ilike.%${search}%,provider_order_id.ilike.%${search}%`,
    );
  }

  const [purchasesResult, currentSubscriptionResult, availablePlansResult] = await Promise.all([
    purchasesQuery,
    supabase
      .from("subscriptions")
      .select("id, plan_id, payment_id, status, starts_at, expires_at, purchased_at")
      .eq("recruiter_id", user.id)
      .in("status", ["active", "lifetime", "expired"])
      .order("purchased_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("plans")
      .select("name, slug")
      .order("display_order", { ascending: true }),
  ]);

  if (purchasesResult.error || currentSubscriptionResult.error || availablePlansResult.error) {
    logPaymentServerError(
      "[billing] billing records lookup failed",
      purchasesResult.error ?? currentSubscriptionResult.error ?? availablePlansResult.error,
    );
    return Response.json({ error: "We could not load billing data." }, { status: 500 });
  }

  const purchaseRows = (purchasesResult.data ?? []) as unknown as PurchaseRow[];
  const currentSubscription = currentSubscriptionResult.data as SubscriptionRow | null;
  const subscriptionIds = [
    ...purchaseRows.map((purchase) => purchase.subscription_id),
    currentSubscription?.id ?? null,
  ].filter((id): id is string => Boolean(id));
  const planIds = [
    ...purchaseRows.map((purchase) => purchase.plan_id),
    currentSubscription?.plan_id ?? null,
  ].filter((id): id is string => Boolean(id));
  const uniqueSubscriptionIds = [...new Set(subscriptionIds)];
  const uniquePlanIds = [...new Set(planIds)];

  const [plansResult, subscriptionsResult, usageResult, currentPurchaseResult] = await Promise.all([
    uniquePlanIds.length
      ? supabase
          .from("plans")
          .select("id, name, slug, price, currency, billing_type, duration_days, job_post_limit, featured_job_limit, active")
          .in("id", uniquePlanIds)
      : Promise.resolve({ data: [], error: null }),
    uniqueSubscriptionIds.length
      ? supabase
          .from("subscriptions")
          .select("id, plan_id, payment_id, status, starts_at, expires_at, purchased_at")
          .eq("recruiter_id", user.id)
          .in("id", uniqueSubscriptionIds)
      : Promise.resolve({ data: [], error: null }),
    currentSubscription?.id
      ? supabase
          .from("plan_usage")
          .select("jobs_posted, featured_jobs_used, remaining_jobs")
          .eq("recruiter_id", user.id)
          .eq("subscription_id", currentSubscription.id)
          .order("period_start", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    currentSubscription?.id
      ? supabase
          .from("purchase_history")
          .select("amount, currency, purchased_at")
          .eq("recruiter_id", user.id)
          .eq("subscription_id", currentSubscription.id)
          .order("purchased_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (
    plansResult.error ||
    subscriptionsResult.error ||
    usageResult.error ||
    currentPurchaseResult.error
  ) {
    logPaymentServerError(
      "[billing] billing enrichment lookup failed",
      plansResult.error ??
        subscriptionsResult.error ??
        usageResult.error ??
        currentPurchaseResult.error,
    );
    return Response.json({ error: "We could not load billing data." }, { status: 500 });
  }

  const planRows = (plansResult.data ?? []) as unknown as PlanRow[];
  const planMap = new Map(planRows.map((plan) => [plan.id, plan]));
  const subscriptionRows = (subscriptionsResult.data ?? []) as unknown as SubscriptionRow[];
  const subscriptionMap = new Map(
    subscriptionRows.map((subscription) => [subscription.id, subscription]),
  );
  const usage = (usageResult.data as UsageRow | null) ?? null;
  const currentPurchase =
    (currentPurchaseResult.data as CurrentPurchaseRow | null) ?? null;
  const currentPlanRow = currentSubscription
    ? planMap.get(currentSubscription.plan_id)
    : undefined;
  const currentPlan = currentSubscription && currentPlanRow
    ? mapCurrentPlan(currentPlanRow, currentSubscription, usage, currentPurchase)
    : null;
  const purchases: BillingPurchaseRecord[] = purchaseRows.map((purchase) => {
    const plan = planMap.get(purchase.plan_id);
    const subscription = purchase.subscription_id
      ? subscriptionMap.get(purchase.subscription_id)
      : undefined;

    return {
      amount: Math.max(0, finiteNumber(purchase.amount)),
      currency: purchase.currency.trim(),
      id: purchase.id,
      paymentProvider: purchase.payment_provider?.trim() || "Unknown",
      paymentReference:
        purchase.payment_reference ?? purchase.provider_payment_id,
      planId: purchase.plan_id,
      planName: plan?.name ?? "Plan unavailable",
      planSlug: plan?.slug ?? "unknown",
      providerOrderId: purchase.provider_order_id,
      providerPaymentId: purchase.provider_payment_id,
      purchasedAt: purchase.purchased_at,
      status: mapBillingPaymentStatus(purchase.status),
      subscriptionActivated: Boolean(purchase.subscription_id),
      subscriptionId: purchase.subscription_id,
      subscriptionStatus: subscription?.status ?? null,
    };
  });
  const total = purchasesResult.count ?? 0;

  return Response.json({
    availablePlans: (availablePlansResult.data ?? []) as unknown as { name: string; slug: string }[],
    currentPlan,
    recruiterName: profile.full_name ?? "Recruiter",
    purchases,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  });
}
