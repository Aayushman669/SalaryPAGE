import {
  DashboardSection,
} from "./dashboard-widgets";
import {
  getRemainingFeaturedJobs,
  getRemainingJobLimit,
  getSubscriptionStatus,
  type SubscriptionSnapshot,
} from "@/lib/subscriptions";

function formatLimit(value: number | "unlimited") {
  return value === "unlimited" ? "Unlimited" : String(value);
}

function getUsagePercent(used: number, limit: number | "unlimited") {
  if (limit === "unlimited" || limit <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((used / limit) * 100));
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

function formatStatus(status: ReturnType<typeof getSubscriptionStatus>) {
  if (status === "lifetime") {
    return "Lifetime";
  }

  if (status === "active") {
    return "Active";
  }

  if (status === "pending") {
    return "Pending";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  if (status === "expired") {
    return "Expired";
  }

  return "No active subscription";
}

export default function RecruiterSubscriptionSummary({
  subscription,
}: {
  subscription: SubscriptionSnapshot;
}) {
  const status = getSubscriptionStatus(subscription);
  const details = [
    {
      label: "Current Plan",
      value: subscription.plan.name,
    },
    {
      label: "Plan Status",
      value: formatStatus(status),
    },
    {
      label: "Remaining Job Posts",
      value: formatLimit(getRemainingJobLimit(subscription)),
    },
    {
      label: "Remaining Featured Jobs",
      value: formatLimit(getRemainingFeaturedJobs(subscription)),
    },
    {
      label: "Jobs Used",
      value: String(subscription.usage.jobsPosted),
    },
    {
      label: "Featured Jobs Used",
      value: String(subscription.usage.featuredJobsUsed),
    },
    {
      label: "Purchase Date",
      value: formatDate(subscription.subscription.purchasedAt),
    },
    {
      label: "Plan Expiry",
      value:
        subscription.subscription.status === "lifetime"
          ? "No expiry"
          : formatDate(subscription.subscription.expiresAt),
    },
  ];

  const jobUsagePercent = getUsagePercent(
    subscription.usage.jobsPosted,
    subscription.plan.jobPostLimit,
  );
  const featuredUsagePercent = getUsagePercent(
    subscription.usage.featuredJobsUsed,
    subscription.plan.featuredJobLimit,
  );

  return (
    <DashboardSection
      description="Subscription limits and lifecycle details from your active plan."
      title="Subscription"
    >
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {details.map((detail) => (
          <div
            key={detail.label}
            className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:bg-white/5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
              {detail.label}
            </p>
            <p className="mt-2 break-words text-base font-bold text-gray-900">
              {detail.value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {[
          {
            label: "Job posting usage",
            percent: jobUsagePercent,
            used: subscription.usage.jobsPosted,
            limit: subscription.plan.jobPostLimit,
          },
          {
            label: "Featured job usage",
            percent: featuredUsagePercent,
            used: subscription.usage.featuredJobsUsed,
            limit: subscription.plan.featuredJobLimit,
          },
        ].map((usage) => (
          <div
            key={usage.label}
            className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:bg-white/5"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-gray-700">{usage.label}</span>
              <span className="font-bold text-gray-900">
                {usage.percent}%
              </span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200"
              role="progressbar"
              aria-label={`${usage.label}: ${usage.percent}% used`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={usage.percent}
            >
              <div
                className="h-full rounded-full bg-yellow-500 transition-[width] duration-300"
                style={{ width: `${usage.percent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {usage.used} used of {formatLimit(usage.limit)}
            </p>
          </div>
        ))}
      </div>
      {status === "lifetime" ? (
        <span className="mt-5 inline-flex rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-gray-900">
          Lifetime plan
        </span>
      ) : null}
    </DashboardSection>
  );
}
