import { logAuthError } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";

export const subscriptionPlanSlugs = [
  "free",
  "starter",
  "growth",
  "pro",
  "enterprise",
] as const;

export type SubscriptionPlanSlug = (typeof subscriptionPlanSlugs)[number];
export type SubscriptionBillingType =
  | "lifetime"
  | "one_time"
  | "monthly"
  | "yearly"
  | "enterprise";
export type SubscriptionStatus =
  | "pending"
  | "active"
  | "expired"
  | "cancelled"
  | "lifetime";
export type PurchaseStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";
export type SubscriptionFeature =
  | "post_job"
  | "feature_job"
  | "premium_analytics"
  | "priority_support"
  | "resume_database";
export type SubscriptionLimit = number | "unlimited";

const fallbackJobPostLimits: Record<SubscriptionPlanSlug, SubscriptionLimit> = {
  enterprise: "unlimited",
  free: 0,
  growth: 5,
  pro: "unlimited",
  starter: 1,
};

export type SubscriptionPlan = {
  active: boolean;
  billingType: SubscriptionBillingType;
  currency: string;
  description: string;
  durationDays: number | null;
  featuredJobLimit: SubscriptionLimit;
  id: string;
  jobPostLimit: SubscriptionLimit;
  name: string;
  advancedAnalyticsAccess: boolean;
  price: number;
  resumeDatabaseAccess: boolean;
  slug: SubscriptionPlanSlug;
  prioritySupport: boolean;
};

export type SubscriptionRecord = {
  createdAt: string;
  expiresAt: string | null;
  id: string;
  paymentId: string | null;
  planId: string;
  purchasedAt: string | null;
  recruiterId: string;
  startsAt: string | null;
  status: SubscriptionStatus;
  updatedAt: string;
};

export type PurchaseHistoryRecord = {
  amount: number;
  currency: string;
  id: string;
  paymentProvider: string | null;
  paymentReference: string | null;
  planId: string;
  purchasedAt: string;
  recruiterId: string;
  refundedAt: string | null;
  refundReference: string | null;
  status: PurchaseStatus;
  subscriptionId: string | null;
};

export type PlanUsage = {
  featuredJobsUsed: number;
  jobsPosted: number;
  remainingFeaturedJobs: SubscriptionLimit;
  periodEnd: string | null;
  periodStart: string;
  remainingJobs: SubscriptionLimit;
  subscriptionId: string | null;
};

export type SubscriptionSnapshot = {
  plan: SubscriptionPlan;
  roleMode: "recruiter" | "job_seeker" | null;
  subscription: {
    expiresAt: string | null;
    id: string | null;
    purchasedAt: string | null;
    startsAt: string | null;
    status: SubscriptionStatus | null;
  };
  usage: PlanUsage;
};

export type SubscriptionAccess = {
  allowed: boolean;
  reason:
    | "allowed"
    | "not_recruiter"
    | "limit_reached"
    | "feature_unavailable"
    | "subscription_pending";
};

type SubscriptionSnapshotRow = {
  billing_type?: string | null;
  duration_days?: number | string | null;
  featured_job_limit?: number | string | null;
  featured_jobs_used?: number | string | null;
  job_post_limit?: number | string | null;
  jobs_posted?: number | string | null;
  plan_currency?: string | null;
  plan_description?: string | null;
  plan_id?: string | null;
  plan_name?: string | null;
  plan_price?: number | string | null;
  plan_slug?: string | null;
  priority_support?: boolean | null;
  advanced_analytics_access?: boolean | null;
  remaining_jobs?: number | string | null;
  resume_database_access?: boolean | null;
  role_mode?: string | null;
  subscription_expires_at?: string | null;
  subscription_id?: string | null;
  subscription_purchased_at?: string | null;
  subscription_starts_at?: string | null;
  subscription_status?: string | null;
  usage_period_end?: string | null;
  usage_period_start?: string | null;
};

const fallbackPlan: SubscriptionPlan = {
  active: true,
  billingType: "lifetime",
  currency: "USD",
  description: "A free recruiter account without publishing access.",
  durationDays: null,
  featuredJobLimit: 0,
  id: "free",
  jobPostLimit: 0,
  name: "Free",
  advancedAnalyticsAccess: false,
  prioritySupport: false,
  resumeDatabaseAccess: false,
  slug: "free",
  price: 0,
};

export function createFreeSubscriptionSnapshot(
  roleMode: SubscriptionSnapshot["roleMode"] = "recruiter",
): SubscriptionSnapshot {
  return {
    plan: fallbackPlan,
    roleMode,
    subscription: {
      expiresAt: null,
      id: null,
      purchasedAt: null,
      startsAt: null,
      status: null,
    },
    usage: {
      featuredJobsUsed: 0,
      jobsPosted: 0,
      remainingFeaturedJobs: 0,
      periodEnd: null,
      periodStart: new Date(0).toISOString(),
      remainingJobs: 0,
      subscriptionId: null,
    },
  };
}

function isSubscriptionPlanSlug(value: string | null | undefined): value is SubscriptionPlanSlug {
  return subscriptionPlanSlugs.includes(value as SubscriptionPlanSlug);
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeLimit(value: unknown): SubscriptionLimit {
  const normalized = normalizeNumber(value);

  return normalized === null ? "unlimited" : Math.max(0, normalized);
}

function normalizeStatus(
  value: string | null | undefined,
): SubscriptionStatus | null {
  return value === "pending" ||
    value === "active" ||
    value === "expired" ||
    value === "cancelled" ||
    value === "lifetime"
    ? value
    : null;
}

function normalizeRole(value: string | null | undefined) {
  return value === "recruiter" || value === "job_seeker" ? value : null;
}

function mapSnapshot(row: SubscriptionSnapshotRow): SubscriptionSnapshot {
  const slug = isSubscriptionPlanSlug(row.plan_slug) ? row.plan_slug : "free";
  const jobPostLimit = normalizeLimit(row.job_post_limit);
  const jobsPosted = Math.max(0, normalizeNumber(row.jobs_posted) ?? 0);
  const featuredJobsUsed = Math.max(
    0,
    normalizeNumber(row.featured_jobs_used) ?? 0,
  );
  const normalizedRemainingJobs = normalizeNumber(row.remaining_jobs);
  const remainingJobs =
    normalizedRemainingJobs !== null
      ? Math.max(0, normalizedRemainingJobs)
      : jobPostLimit;
  const featuredJobLimit = normalizeLimit(row.featured_job_limit);
  const plan: SubscriptionPlan = {
    active: true,
    billingType:
      row.billing_type === "one_time" ||
      row.billing_type === "monthly" ||
      row.billing_type === "yearly" ||
      row.billing_type === "enterprise"
        ? row.billing_type
        : "lifetime",
    currency: row.plan_currency?.trim().toUpperCase() || "USD",
    description: row.plan_description?.trim() || "",
    durationDays: normalizeNumber(row.duration_days),
    featuredJobLimit,
    id: row.plan_id || slug,
    jobPostLimit,
    name: row.plan_name?.trim() || "Free",
    advancedAnalyticsAccess: row.advanced_analytics_access === true,
    prioritySupport: row.priority_support === true,
    resumeDatabaseAccess: row.resume_database_access === true,
    slug,
    price: Math.max(0, normalizeNumber(row.plan_price) ?? 0),
  };

  return {
    plan,
    roleMode: normalizeRole(row.role_mode),
    subscription: {
      expiresAt: row.subscription_expires_at ?? null,
      id: row.subscription_id ?? null,
      purchasedAt: row.subscription_purchased_at ?? null,
      startsAt: row.subscription_starts_at ?? null,
      status: normalizeStatus(row.subscription_status),
    },
    usage: {
      featuredJobsUsed,
      jobsPosted,
      remainingFeaturedJobs:
        featuredJobLimit === "unlimited"
          ? "unlimited"
          : Math.max(featuredJobLimit - featuredJobsUsed, 0),
      periodEnd: row.usage_period_end ?? null,
      periodStart: row.usage_period_start ?? new Date(0).toISOString(),
      remainingJobs,
      subscriptionId: row.subscription_id ?? null,
    },
  };
}

export async function getSubscriptionSnapshot(): Promise<{
  error: string | null;
  snapshot: SubscriptionSnapshot | null;
}> {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      snapshot: null,
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_my_subscription_snapshot");

    if (error) {
      logAuthError("[subscriptions] snapshot fetch failed", error);
      return {
        error: "We could not load your subscription details. Please try again.",
        snapshot: null,
      };
    }

    const row = ((data ?? []) as SubscriptionSnapshotRow[])[0];

    if (!row) {
      return {
        error: null,
        snapshot: createFreeSubscriptionSnapshot(null),
      };
    }

    return { error: null, snapshot: mapSnapshot(row) };
  } catch (error) {
    logAuthError("[subscriptions] snapshot network failure", error);
    return {
      error: "We could not connect. Please try again.",
      snapshot: null,
    };
  }
}

export async function getCurrentPlan() {
  const result = await getSubscriptionSnapshot();
  return {
    error: result.error,
    plan: result.snapshot?.plan ?? null,
  };
}

export async function getRemainingLimits() {
  const result = await getSubscriptionSnapshot();
  const snapshot = result.snapshot;

  return {
    error: result.error,
    featuredJobs: snapshot ? getRemainingFeaturedJobs(snapshot) : 0,
    jobs: snapshot ? getRemainingJobLimit(snapshot) : 0,
  };
}

export function getRemainingJobLimit(snapshot: SubscriptionSnapshot): SubscriptionLimit {
  return getRemainingJobLimitForUsedJobs(snapshot, snapshot.usage.jobsPosted);
}

export function getRemainingJobLimitForUsedJobs(
  snapshot: SubscriptionSnapshot,
  usedJobs: number,
): SubscriptionLimit {
  if (snapshot.plan.jobPostLimit === "unlimited") {
    return "unlimited";
  }

  return Math.max(snapshot.plan.jobPostLimit - Math.max(0, usedJobs), 0);
}

export function getConfiguredJobPostLimit(
  plan: SubscriptionPlanSlug,
): SubscriptionLimit {
  return fallbackJobPostLimits[plan];
}

export function getRemainingJobs(snapshot: SubscriptionSnapshot) {
  return getRemainingJobLimit(snapshot);
}

export function getRemainingFeaturedJobs(
  snapshot: SubscriptionSnapshot,
): SubscriptionLimit {
  if (snapshot.plan.featuredJobLimit === "unlimited") {
    return "unlimited";
  }

  if (snapshot.usage.remainingFeaturedJobs !== "unlimited") {
    return Math.max(snapshot.usage.remainingFeaturedJobs, 0);
  }

  return Math.max(
    snapshot.plan.featuredJobLimit - snapshot.usage.featuredJobsUsed,
    0,
  );
}

export function getPlanName(snapshot: SubscriptionSnapshot) {
  return snapshot.plan.name;
}

export function getActivePlan(snapshot: SubscriptionSnapshot) {
  return snapshot.plan;
}

export function hasActiveSubscription(snapshot: SubscriptionSnapshot) {
  return (
    snapshot.roleMode === "recruiter" &&
    (snapshot.subscription.status === "active" ||
      snapshot.subscription.status === "lifetime")
  );
}

export function getSubscriptionStatus(snapshot: SubscriptionSnapshot) {
  return snapshot.subscription.status;
}

export function canPostJob(snapshot: SubscriptionSnapshot): SubscriptionAccess {
  if (snapshot.roleMode !== "recruiter") {
    return { allowed: false, reason: "not_recruiter" };
  }

  if (snapshot.subscription.status === "pending") {
    return { allowed: false, reason: "subscription_pending" };
  }

  if (!hasActiveSubscription(snapshot)) {
    return { allowed: false, reason: "feature_unavailable" };
  }

  const remaining = getRemainingJobLimit(snapshot);

  return remaining === "unlimited" || remaining > 0
    ? { allowed: true, reason: "allowed" }
    : { allowed: false, reason: "limit_reached" };
}

export function canFeatureJob(snapshot: SubscriptionSnapshot): SubscriptionAccess {
  if (snapshot.roleMode !== "recruiter") {
    return { allowed: false, reason: "not_recruiter" };
  }

  if (snapshot.subscription.status === "pending") {
    return { allowed: false, reason: "subscription_pending" };
  }

  if (!hasActiveSubscription(snapshot)) {
    return { allowed: false, reason: "feature_unavailable" };
  }

  const limit = snapshot.plan.featuredJobLimit;
  const allowed =
    limit === "unlimited" || snapshot.usage.featuredJobsUsed < limit;

  return allowed
    ? { allowed: true, reason: "allowed" }
    : { allowed: false, reason: "feature_unavailable" };
}

export function canAccessResumeDatabase(
  snapshot: SubscriptionSnapshot,
): SubscriptionAccess {
  if (snapshot.roleMode !== "recruiter") {
    return { allowed: false, reason: "not_recruiter" };
  }

  if (!hasActiveSubscription(snapshot)) {
    return { allowed: false, reason: "feature_unavailable" };
  }

  return snapshot.plan.resumeDatabaseAccess
    ? { allowed: true, reason: "allowed" }
    : { allowed: false, reason: "feature_unavailable" };
}

export function canViewPremiumAnalytics(
  snapshot: SubscriptionSnapshot,
): SubscriptionAccess {
  if (snapshot.roleMode !== "recruiter") {
    return { allowed: false, reason: "not_recruiter" };
  }

  if (!hasActiveSubscription(snapshot)) {
    return { allowed: false, reason: "feature_unavailable" };
  }

  return snapshot.plan.advancedAnalyticsAccess
    ? { allowed: true, reason: "allowed" }
    : { allowed: false, reason: "feature_unavailable" };
}

export function canPurchasePlan(
  snapshot: SubscriptionSnapshot,
): SubscriptionAccess {
  if (snapshot.roleMode !== "recruiter") {
    return { allowed: false, reason: "not_recruiter" };
  }

  return snapshot.subscription.status === "pending"
    ? { allowed: false, reason: "subscription_pending" }
    : { allowed: true, reason: "allowed" };
}

export function hasSubscriptionFeature(
  snapshot: SubscriptionSnapshot,
  feature: SubscriptionFeature,
) {
  if (feature === "post_job") {
    return canPostJob(snapshot).allowed;
  }

  if (feature === "feature_job") {
    return canFeatureJob(snapshot).allowed;
  }

  if (feature === "premium_analytics") {
    return canViewPremiumAnalytics(snapshot).allowed;
  }

  if (feature === "priority_support") {
    return snapshot.plan.prioritySupport;
  }

  return snapshot.plan.resumeDatabaseAccess;
}

export function canPurchaseAgain(snapshot: SubscriptionSnapshot) {
  return canPurchasePlan(snapshot).allowed;
}
