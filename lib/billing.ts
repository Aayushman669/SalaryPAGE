export const billingPaymentStatuses = [
  "pending",
  "paid",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
  "cancelled",
  "unknown",
] as const;

export type BillingPaymentStatus = (typeof billingPaymentStatuses)[number];
export type BillingLimit = number | "unlimited";

export type BillingStatusDisplay = {
  className: string;
  description: string;
  label: string;
};

export type BillingPurchaseRecord = {
  amount: number;
  currency: string;
  id: string;
  paymentProvider: string;
  paymentReference: string | null;
  planId: string;
  planName: string;
  planSlug: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  purchasedAt: string;
  status: BillingPaymentStatus;
  subscriptionActivated: boolean;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
};

export type BillingCurrentPlan = {
  amount: number;
  billingType: string;
  currency: string;
  expiresAt: string | null;
  featuredJobLimit: BillingLimit;
  featuredJobsUsed: number;
  isActive: boolean;
  jobPostLimit: BillingLimit;
  jobsPosted: number;
  planId: string;
  planName: string;
  planSlug: string;
  purchasedAt: string | null;
  remainingFeaturedJobs: BillingLimit;
  remainingJobs: BillingLimit;
  startsAt: string | null;
  status: string;
  subscriptionId: string | null;
  usageAvailable: boolean;
};

export type BillingResponse = {
  availablePlans: { name: string; slug: string }[];
  currentPlan: BillingCurrentPlan | null;
  recruiterName: string;
  purchases: BillingPurchaseRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const statusDisplay: Record<BillingPaymentStatus, BillingStatusDisplay> = {
  pending: {
    className: "border-yellow-300 bg-yellow-50 text-gray-900 dark:bg-yellow-500/15 dark:text-yellow-100",
    description: "Payment is still being confirmed.",
    label: "Pending",
  },
  paid: {
    className: "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200",
    description: "Payment was verified successfully.",
    label: "Paid",
  },
  captured: {
    className: "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200",
    description: "Payment was captured by the payment provider.",
    label: "Captured",
  },
  failed: {
    className: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
    description: "Payment did not complete.",
    label: "Failed",
  },
  refunded: {
    className: "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
    description: "Payment was refunded.",
    label: "Refunded",
  },
  partially_refunded: {
    className: "border-yellow-300 bg-yellow-50 text-gray-900 dark:bg-yellow-500/15 dark:text-yellow-100",
    description: "Payment was partially refunded.",
    label: "Partially Refunded",
  },
  cancelled: {
    className: "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
    description: "Payment was cancelled.",
    label: "Cancelled",
  },
  unknown: {
    className: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
    description: "Payment status is not available.",
    label: "Unknown",
  },
};

export function mapBillingPaymentStatus(value: unknown): BillingPaymentStatus {
  if (typeof value !== "string") {
    return "unknown";
  }

  if (value === "paid" || value === "captured") {
    return value;
  }

  return billingPaymentStatuses.includes(value as BillingPaymentStatus)
    ? (value as BillingPaymentStatus)
    : "unknown";
}

export function getBillingStatusDisplay(value: unknown) {
  return statusDisplay[mapBillingPaymentStatus(value)];
}

export function formatBillingLimit(value: BillingLimit) {
  return value === "unlimited" ? "Unlimited" : String(value);
}

export function formatBillingDate(value: string | null | undefined) {
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

export function formatBillingDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function calculateBillingUsagePercent(
  used: number,
  limit: BillingLimit,
) {
  if (limit === "unlimited" || limit <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((Math.max(0, used) / limit) * 100));
}
