"use client";

import Link from "next/link";
import type { PlanId, PricingFeatureGroup } from "@/lib/plans";

type PricingPlan = {
  id: PlanId;
  name: string;
  price: number;
  billingLabel: string;
  badge: string | null;
  ctaLabel: string;
  description: string;
  featureGroups: readonly PricingFeatureGroup[];
};

type PricingCardProps = {
  plan: PricingPlan;
  isSelected?: boolean;
  onSelect?: (planId: PlanId) => void;
  ctaHref?: string;
};

function FeatureList({ groups }: { groups: readonly PricingFeatureGroup[] }) {
  return (
    <div className="mt-7 flex flex-1 flex-col gap-7 border-t border-gray-200 pt-6 dark:border-white/10">
      {groups.map((group, groupIndex) => (
        <div key={group.title ?? `features-${groupIndex}`}>
          {group.title ? (
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {group.title}
            </h3>
          ) : null}
          <ul className="flex flex-col gap-3.5 text-sm leading-6 text-gray-700 dark:text-gray-300">
            {group.items.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
                >
                  {"\u2713"}
                </span>
                <span className="font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function PricingCard({
  plan,
  isSelected = false,
  onSelect,
  ctaHref,
}: PricingCardProps) {
  const isGrowth = plan.id === "growth";
  const isPro = plan.id === "pro";
  const ctaClassName =
    "mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl bg-black px-5 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_16px_34px_rgba(17,24,39,0.18)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none dark:bg-white dark:text-gray-950 dark:hover:bg-yellow-300";
  const cardClassName = isGrowth
    ? "border border-yellow-400/80 bg-white shadow-[0_30px_90px_rgba(234,179,8,0.18)] hover:shadow-[0_34px_100px_rgba(234,179,8,0.24)] dark:bg-[#191919]"
    : isPro
      ? "border border-cyan-300/70 bg-white shadow-[0_24px_70px_rgba(14,165,233,0.12)] hover:shadow-[0_30px_90px_rgba(14,165,233,0.18)] dark:bg-[#171a1f]"
      : "border border-gray-200 bg-white shadow-[0_20px_60px_rgba(17,24,39,0.08)] hover:shadow-xl dark:border-gray-700 dark:bg-[#171719]";
  const badgeClassName = isPro
    ? "bg-cyan-300 text-gray-950"
    : "bg-yellow-400 text-gray-950";

  return (
    <article
      className={`group relative flex h-full flex-col rounded-2xl p-7 text-left transition-all duration-300 hover:scale-[1.02] ${cardClassName}`}
    >
      {isGrowth ? (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-yellow-400/5" />
      ) : null}
      {isPro ? (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-cyan-300/5" />
      ) : null}
      <div className="relative flex min-h-full flex-1 flex-col">
        <div className="mb-4 min-h-6">
          {plan.badge ? (
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${badgeClassName}`}>
              {plan.badge}
            </span>
          ) : null}
        </div>

        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {plan.name}
        </h2>
        <p className="mt-2 min-h-[3.5rem] text-sm leading-6 text-gray-500 dark:text-gray-400">
          {plan.description}
        </p>

        <div className="mt-7 flex items-end gap-2">
          <span className="text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            ${plan.price}
          </span>
          <span className="pb-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400">
            {plan.billingLabel}
          </span>
        </div>

        <FeatureList groups={plan.featureGroups} />

        {ctaHref ? (
          <Link href={ctaHref} className={ctaClassName}>
            {plan.ctaLabel}
          </Link>
        ) : (
          <button
            type="button"
            disabled={isSelected}
            onClick={() => onSelect?.(plan.id)}
            className={ctaClassName}
          >
            {isSelected ? "Opening..." : plan.ctaLabel}
          </button>
        )}
      </div>
    </article>
  );
}

const trustItems = [
  "One-Time Payment",
  "No Monthly Subscription",
  "Lifetime Access",
  "Recruiter Dashboard Included",
  "Built for Growing Teams",
] as const;

export function PricingTrustSection() {
  return (
    <section
      aria-label="Pricing trust details"
      className="mt-10 grid grid-cols-2 gap-3 border-t border-gray-200 pt-8 text-center sm:grid-cols-3 lg:grid-cols-5 dark:border-gray-700"
    >
      {trustItems.map((item) => (
        <div
          key={item}
          className="flex items-center justify-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
          >
            {"\u2713"}
          </span>
          <span>{item}</span>
        </div>
      ))}
    </section>
  );
}
