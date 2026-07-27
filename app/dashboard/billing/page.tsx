"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/auth-context";
import RetryPaymentButton from "./retry-payment-button";
import {
  calculateBillingUsagePercent,
  formatBillingDate,
  formatBillingDateTime,
  formatBillingLimit,
  getBillingStatusDisplay,
  type BillingCurrentPlan,
  type BillingPurchaseRecord,
  type BillingResponse,
} from "@/lib/billing";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type BillingFilters = {
  from: string;
  plan: string;
  search: string;
  status: string;
  to: string;
};

const initialFilters: BillingFilters = {
  from: "",
  plan: "",
  search: "",
  status: "",
  to: "",
};

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      currency,
      maximumFractionDigits: 2,
      style: "currency",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatSubscriptionStatus(status: string) {
  if (status === "lifetime") return "Lifetime";
  if (status === "active") return "Active";
  if (status === "expired") return "Expired";
  if (status === "cancelled") return "Cancelled";
  return "No active subscription";
}

function StatusBadge({ status }: { status: string }) {
  const display = getBillingStatusDisplay(status);

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${display.className}`}
      title={display.description}
      role="status"
    >
      {display.label}
    </span>
  );
}

function LoadingState() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading billing"
      className="min-h-screen bg-white px-6 py-10 text-gray-900 sm:px-8 sm:py-14 lg:px-12"
      role="status"
    >
      <section className="mx-auto max-w-6xl animate-pulse">
        <div className="h-4 w-24 rounded-full bg-gray-100" />
        <div className="mt-5 h-12 w-72 rounded-2xl bg-gray-100" />
        <div className="mt-10 h-64 rounded-2xl border border-gray-200 bg-white" />
        <div className="mt-8 h-96 rounded-2xl border border-gray-200 bg-white" />
      </section>
    </main>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-10 text-gray-900 lg:px-12">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-[0_20px_60px_rgba(17,24,39,0.08)]">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
          Billing
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
          Billing is unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
        >
          Retry
        </button>
      </section>
    </main>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: BillingCurrentPlan["jobPostLimit"] }) {
  const percent = calculateBillingUsagePercent(used, limit);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className="font-bold text-gray-900">{percent}%</span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-label={`${label}: ${percent}% used`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
      >
        <div className="h-full rounded-full bg-yellow-500" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {used} used of {formatBillingLimit(limit)}
      </p>
    </div>
  );
}

function CurrentPlanCard({ plan }: { plan: BillingCurrentPlan | null }) {
  if (!plan || !plan.isActive) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_20px_60px_rgba(17,24,39,0.08)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
          Current plan
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
          No active plan
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">
          Choose a plan to start publishing jobs and unlock recruiter features.
        </p>
        {plan && !plan.isActive ? (
          <p className="mt-3 text-xs font-medium text-gray-500">
            Previous plan: {plan.planName} ({formatSubscriptionStatus(plan.status)})
          </p>
        ) : null}
        <Link
          href="/pricing"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
        >
          View Pricing
        </Link>
      </section>
    );
  }

  const details = [
    ["Plan", plan.planName],
    ["Status", formatSubscriptionStatus(plan.status)],
    ["Amount paid", formatMoney(plan.amount, plan.currency)],
    ["Billing type", plan.billingType.replaceAll("_", " ")],
    ["Purchase date", formatBillingDate(plan.purchasedAt)],
    ["Expiry", plan.expiresAt ? formatBillingDate(plan.expiresAt) : "No expiry"],
    ["Remaining jobs", formatBillingLimit(plan.remainingJobs)],
    ["Remaining featured", formatBillingLimit(plan.remainingFeaturedJobs)],
  ];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_20px_60px_rgba(17,24,39,0.08)] sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
            Current plan
          </p>
          <h2 className="mt-3 break-words text-3xl font-bold tracking-tight text-gray-900">
            {plan.planName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Your verified subscription and materialized usage limits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-gray-900">
            {formatSubscriptionStatus(plan.status)}
          </span>
          {plan.status === "lifetime" ? (
            <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
              Lifetime
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {details.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</p>
            <p className="mt-2 break-words text-sm font-bold capitalize text-gray-900">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <UsageBar label="Job posting usage" used={plan.jobsPosted} limit={plan.jobPostLimit} />
        <UsageBar label="Featured job usage" used={plan.featuredJobsUsed} limit={plan.featuredJobLimit} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/pricing"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
        >
          Purchase Another Plan
        </Link>
      </div>
    </section>
  );
}

function ReceiptButton({ purchase, recruiterName }: { purchase: BillingPurchaseRecord; recruiterName: string }) {
  function printReceipt() {
    const escapeHtml = (value: string) =>
      value.replace(/[&<>'"]/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character);
    const receiptWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!receiptWindow) {
      showErrorToast("Please allow pop-ups to print your receipt.");
      return;
    }

    const providerReference = purchase.paymentReference ?? "Not available";
    receiptWindow.document.write(`<!doctype html><html><head><title>Job Board payment receipt</title><style>body{font-family:Arial,sans-serif;color:#111827;max-width:680px;margin:48px auto;padding:0 24px}h1{font-size:28px}p{color:#6b7280}.row{display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding:12px 0;gap:24px}.label{color:#6b7280}.notice{margin-top:28px;font-size:12px;color:#6b7280}@media print{body{margin:0}}</style></head><body><h1>Job Board</h1><p>Payment receipt</p><div class="row"><span class="label">Recruiter</span><strong>${escapeHtml(recruiterName)}</strong></div><div class="row"><span class="label">Plan</span><strong>${escapeHtml(purchase.planName)}</strong></div><div class="row"><span class="label">Amount</span><strong>${escapeHtml(formatMoney(purchase.amount, purchase.currency))}</strong></div><div class="row"><span class="label">Payment reference</span><strong>${escapeHtml(providerReference)}</strong></div><div class="row"><span class="label">Purchase date</span><strong>${escapeHtml(formatBillingDateTime(purchase.purchasedAt))}</strong></div><div class="row"><span class="label">Payment status</span><strong>${escapeHtml(getBillingStatusDisplay(purchase.status).label)}</strong></div><p class="notice">This is a payment receipt, not a tax invoice.</p><script>window.onload=function(){window.print()}</script></body></html>`);
    receiptWindow.document.close();
  }

  return (
    <button
      type="button"
      disabled={purchase.status !== "paid" && purchase.status !== "captured"}
      onClick={printReceipt}
      className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Receipt
    </button>
  );
}

function TransactionDialog({
  onClose,
  purchase,
  recruiterName,
}: {
  onClose: () => void;
  purchase: BillingPurchaseRecord;
  recruiterName: string;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);

      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/35 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_28px_90px_rgba(17,24,39,0.22)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Transaction</p>
            <h2 className="mt-2 break-words text-xl font-bold tracking-tight text-gray-900">{purchase.planName}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close transaction details"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-lg text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            x
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            ["Recruiter", recruiterName],
            ["Plan", purchase.planName],
            ["Amount", formatMoney(purchase.amount, purchase.currency)],
            ["Purchase date", formatBillingDateTime(purchase.purchasedAt)],
            ["Provider", purchase.paymentProvider],
            ["Payment status", getBillingStatusDisplay(purchase.status).label],
            ["Payment reference", purchase.providerPaymentId ?? purchase.paymentReference ?? "Not available"],
            ["Order reference", purchase.providerOrderId ?? "Not available"],
            ["Subscription", purchase.subscriptionActivated ? "Activated" : "Activation pending"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</p>
              <p className="mt-2 break-words text-sm font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <ReceiptButton purchase={purchase} recruiterName={recruiterName} />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseRecord({
  onOpen,
  onRetry,
  purchase,
  recruiterName,
}: {
  onOpen: () => void;
  onRetry: () => void;
  purchase: BillingPurchaseRecord;
  recruiterName: string;
}) {
  const canRetry = purchase.status === "pending" || purchase.status === "failed";

  return (
    <article className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-sm font-bold text-gray-900">{purchase.planName}</h3>
            <StatusBadge status={purchase.status} />
          </div>
          <p className="mt-2 break-all text-xs text-gray-500">
            {purchase.paymentReference ?? "Payment reference unavailable"}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-gray-500">
            <span>{formatBillingDate(purchase.purchasedAt)}</span>
            <span>{formatMoney(purchase.amount, purchase.currency)}</span>
            <span>{purchase.paymentProvider}</span>
            <span>{purchase.subscriptionActivated ? "Subscription activated" : "Activation pending"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {canRetry ? (
            <RetryPaymentButton onComplete={onRetry} planSlug={purchase.planSlug} />
          ) : null}
          <ReceiptButton purchase={purchase} recruiterName={recruiterName} />
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            View details
          </button>
        </div>
      </div>
    </article>
  );
}

export default function BillingPage() {
  const { isAuthLoading, isLoggedIn } = useAuth();
  const [data, setData] = useState<BillingResponse | null>(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<BillingFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedPurchase, setSelectedPurchase] = useState<BillingPurchaseRecord | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (isAuthLoading || !isLoggedIn) return;

    let isMounted = true;

    async function loadBilling() {
      await Promise.resolve();

      if (!isMounted) return;

      setLoading(true);
      setError("");

      try {
        if (!supabase) throw new Error("Supabase is not configured.");
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Your session expired. Please log in again.");

        const params = new URLSearchParams({ page: String(page) });
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });
        const response = await fetch(`/api/billing?${params.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = (await response.json()) as BillingResponse & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "We could not load billing data.");

        if (isMounted) setData(result);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "We could not load billing data.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadBilling();

    return () => {
      isMounted = false;
    };
  }, [filters, isAuthLoading, isLoggedIn, page, retryKey]);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("payment") === "success") {
      showSuccessToast("Payment verified. Your subscription is active.");
      window.history.replaceState({}, "", "/dashboard/billing");
    }
  }, []);

  if (isAuthLoading || loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={() => setRetryKey((value) => value + 1)} />;

  const currentData = data ?? { currentPlan: null, recruiterName: "Recruiter", purchases: [], pagination: { page, pageSize: 10, total: 0, totalPages: 0 }, availablePlans: [] };

  function updateFilter(key: keyof BillingFilters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-gray-900 sm:px-8 sm:py-14 lg:px-12">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Billing</p>
            <h1 className="mt-4 break-words text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">Plans & payments</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-500">Review your verified subscription, usage limits, and one-time purchase history.</p>
          </div>
          <Link href="/dashboard" className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-900 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:bg-yellow-50 focus:outline-none focus:ring-4 focus:ring-yellow-200">Back to Dashboard</Link>
        </div>

        <div className="mt-10"><CurrentPlanCard plan={currentData.currentPlan} /></div>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_20px_60px_rgba(17,24,39,0.08)] sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">Purchase history</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">Verified payment records for your recruiter account.</p>
            </div>
            {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select aria-label="Filter by payment status" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100">
              <option value="">All statuses</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="refunded">Refunded</option><option value="partially_refunded">Partially refunded</option><option value="cancelled">Cancelled</option>
            </select>
            <select aria-label="Filter by plan" value={filters.plan} onChange={(event) => updateFilter("plan", event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100">
              <option value="">All plans</option>{currentData.availablePlans?.map((plan) => <option key={plan.slug} value={plan.slug}>{plan.name}</option>)}
            </select>
            <input aria-label="Filter purchases from date" type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" />
            <input aria-label="Filter purchases to date" type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" />
            <input aria-label="Search payment references" type="search" placeholder="Search references" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" />
          </div>

          {currentData.purchases.length ? (
            <>
              <div className="mt-6 hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead><tr className="border-b border-gray-200 text-xs uppercase tracking-[0.12em] text-gray-500"><th className="px-3 py-3 font-semibold">Purchase date</th><th className="px-3 py-3 font-semibold">Plan</th><th className="px-3 py-3 font-semibold">Reference</th><th className="px-3 py-3 font-semibold">Amount</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Action</th></tr></thead>
                  <tbody>{currentData.purchases.map((purchase) => <tr key={purchase.id} className="border-b border-gray-100 last:border-0"><td className="px-3 py-4 text-gray-600">{formatBillingDate(purchase.purchasedAt)}</td><td className="px-3 py-4 font-semibold text-gray-900">{purchase.planName}</td><td className="max-w-[180px] break-all px-3 py-4 text-xs text-gray-500">{purchase.paymentReference ?? "Not available"}</td><td className="px-3 py-4 font-semibold text-gray-900">{formatMoney(purchase.amount, purchase.currency)}</td><td className="px-3 py-4"><StatusBadge status={purchase.status} /></td><td className="px-3 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedPurchase(purchase)} className="text-xs font-semibold text-gray-900 underline decoration-yellow-400 underline-offset-4 focus:outline-none focus:ring-4 focus:ring-yellow-200">Details</button>{purchase.status === "pending" || purchase.status === "failed" ? <RetryPaymentButton onComplete={() => setRetryKey((value) => value + 1)} planSlug={purchase.planSlug} /> : null}</div></td></tr>)}</tbody>
                </table>
              </div>
              <div className="mt-6 grid gap-3 lg:hidden">{currentData.purchases.map((purchase) => <PurchaseRecord key={purchase.id} onOpen={() => setSelectedPurchase(purchase)} onRetry={() => setRetryKey((value) => value + 1)} purchase={purchase} recruiterName={currentData.recruiterName} />)}</div>
            </>
          ) : (
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-5 py-8 text-center"><h3 className="text-base font-bold text-gray-900">No purchases yet</h3><p className="mt-2 text-sm leading-6 text-gray-500">Your verified one-time plan purchases will appear here.</p><Link href="/pricing" className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200">View Pricing</Link></div>
          )}

          {currentData.pagination.totalPages > 1 ? <div className="mt-6 flex items-center justify-between gap-4"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-40">Previous</button><p className="text-sm text-gray-500">Page {currentData.pagination.page} of {currentData.pagination.totalPages}</p><button type="button" disabled={page >= currentData.pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-40">Next</button></div> : null}
        </section>
      </section>
      {selectedPurchase ? <TransactionDialog onClose={() => setSelectedPurchase(null)} purchase={selectedPurchase} recruiterName={currentData.recruiterName} /> : null}
    </main>
  );
}
