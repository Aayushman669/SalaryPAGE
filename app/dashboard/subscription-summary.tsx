import Link from "next/link";
import { DashboardSection } from "./dashboard-widgets";
import {
  getSubscriptionStatus,
  hasActiveSubscription,
  type SubscriptionLimit,
  type SubscriptionSnapshot,
} from "@/lib/subscriptions";

function getUsagePercent(used: number, limit: SubscriptionLimit) {
  if (limit === "unlimited" || limit <= 0) return 0;
  return Math.min(100, Math.round((Math.max(0, used) / limit) * 100));
}

function formatStatus(status: ReturnType<typeof getSubscriptionStatus>, activePaidPlan: boolean) {
  if (activePaidPlan) return status === "lifetime" ? "Lifetime" : "Active";
  if (status === "pending") return "Pending";
  if (status === "expired") return "Expired";
  if (status === "cancelled") return "Cancelled";
  return "No paid plan";
}

function statusClass(activePaidPlan: boolean, status: ReturnType<typeof getSubscriptionStatus>) {
  if (activePaidPlan || status === "lifetime") return "border-yellow-300 bg-yellow-50 text-yellow-900";
  if (status === "pending") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-gray-200 bg-gray-100 text-gray-700";
}

export default function RecruiterSubscriptionSummary({
  subscription,
}: {
  subscription: SubscriptionSnapshot;
}) {
  const status = getSubscriptionStatus(subscription);
  const activePaidPlan = hasActiveSubscription(subscription) && subscription.plan.slug !== "free";
  const planStatus = formatStatus(status, activePaidPlan);
  const planDescription = activePaidPlan
    ? `${subscription.plan.name} access is active.`
    : status === "pending"
      ? "Your payment is being verified."
      : "Basic access is active.";
  const jobLimit = subscription.plan.jobPostLimit;
  const jobUsagePercent = getUsagePercent(subscription.usage.jobsPosted, jobLimit);
  const hasJobLimit = jobLimit === "unlimited" || (typeof jobLimit === "number" && jobLimit > 0);
  const jobUsageLabel = !hasJobLimit
    ? "No posting slots available"
    : jobLimit === "unlimited"
      ? `${subscription.usage.jobsPosted} Used - Unlimited available`
      : `${subscription.usage.jobsPosted} / ${jobLimit} Used`;

  return (
    <DashboardSection
      description="Track your plan, posting limits, and available recruiter benefits."
      title="Plan & Usage"
    >
      <div className="mt-5 grid items-stretch gap-4 md:grid-cols-2">
        <article className="h-full rounded-xl border border-gray-200 bg-gray-50 p-5 transition hover:border-yellow-300/70 hover:shadow-[0_14px_34px_rgba(17,24,39,0.08)] dark:bg-white/5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Plan Overview</p>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusClass(activePaidPlan, status)}`} role="status">
              {planStatus}
            </span>
          </div>
          <p className="mt-5 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{activePaidPlan ? subscription.plan.name : "Free"}</p>
          <p className="mt-2 text-sm leading-6 text-gray-500">{planDescription}</p>
        </article>

        <article className="h-full rounded-xl border border-gray-200 bg-gray-50 p-5 transition hover:border-yellow-300/70 hover:shadow-[0_14px_34px_rgba(17,24,39,0.08)] dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Job Usage</p>
          <p className="mt-5 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{jobUsageLabel}</p>
          {hasJobLimit ? (
            <div
              aria-label={`Active job posts: ${subscription.usage.jobsPosted} of ${jobLimit} used`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={jobUsagePercent}
              className="mt-5 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
              role="progressbar"
            >
              <div className="h-full rounded-full bg-yellow-500 transition-[width] duration-300" style={{ width: `${jobUsagePercent}%` }} />
            </div>
          ) : (
            <p className="mt-5 text-sm text-gray-500">Upgrade to unlock active job posting slots.</p>
          )}
        </article>
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-xl border border-yellow-200 bg-yellow-50/70 p-5 transition hover:border-yellow-300 hover:shadow-[0_14px_34px_rgba(234,179,8,0.12)] dark:border-yellow-300/30 dark:bg-yellow-300/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-yellow-50">🚀 Unlock More Hiring Power</h3>
          <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-yellow-100/80">Upgrade your plan to post more jobs and unlock advanced recruiter tools.</p>
        </div>
        <Link className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white dark:text-gray-950 dark:hover:bg-yellow-300" href="/pricing">Upgrade Plan</Link>
      </div>
    </DashboardSection>
  );
}
