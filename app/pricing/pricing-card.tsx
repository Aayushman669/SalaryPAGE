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
  className?: string;
  showPlanArtwork?: boolean;
};

function RocketIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 32 32">
      <path d="M13.5 19.5 8 25l-1-4.5L11.5 16M18.5 13.5 24 8l-4.5-1L16 11.5M10 22l-3 3M15 25c5.8-2.2 9.6-6.7 11-18-11.3 1.4-15.8 5.2-18 11l7 7Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="19.5" cy="12.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 32 32">
      <path d="M6 24h20M8 21l6-7 5 4 7-10m0 0h-7m7 0v7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 32 32">
      <path d="m6 11 6 6 4-9 4 9 6-6-2 13H8L6 11Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9 27h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function PlanIcon({ planId }: { planId: PlanId }) {
  if (planId === "starter") {
    return (
      <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#F0EAFF] text-[#6647F0]">
        <RocketIcon />
      </span>
    );
  }

  if (planId === "growth") {
    return (
      <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#FFF1C8] text-[#E6A100]">
        <TrendIcon />
      </span>
    );
  }

  return (
    <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#E9F5FF] text-[#1F5CFF]">
      <CrownIcon />
    </span>
  );
}

function PlanArtwork({ planId }: { planId: PlanId }) {
  if (planId === "starter") {
    return (
      <div aria-hidden="true" className="pricing-plan-art pricing-plan-art-starter">
        <svg fill="none" viewBox="0 0 90 80">
          <path className="pricing-plan-draw" d="M18 57c11-25 30-39 56-39-2 22-13 40-39 50l-17-11Zm17 11-2 9m-10-16-9 2m20-28 11 10" pathLength="1" />
          <path className="pricing-plan-draw" d="M47 26c5-5 10-7 16-8m-18 20 13 12m-24-3 11 11" pathLength="1" />
          <circle className="pricing-plan-dot" cx="54" cy="31" r="3" />
        </svg>
      </div>
    );
  }

  if (planId === "growth") {
    return (
      <div aria-hidden="true" className="pricing-plan-art pricing-plan-art-growth">
        <svg fill="none" viewBox="0 0 90 80">
          <path className="pricing-plan-draw" d="M14 58c12-1 17-10 25-16 8-6 14-4 21-13 5-6 10-10 18-14" pathLength="1" />
          <path className="pricing-plan-draw" d="m63 16 16-1-7 14m-32 12 9 1m17-14 8 7" pathLength="1" />
        </svg>
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="pricing-plan-art pricing-plan-art-pro">
      <svg fill="none" viewBox="0 0 90 80">
        <path className="pricing-plan-draw" d="M10 67h70M15 67V43h12v24m4 0V28h14v39m5 0V17h14v50m5 0V35h12v32M18 49h6m8-12h8m13-12h8m17 17h6m-47 11h8m16-13h8m15 15h6" pathLength="1" />
        <path className="pricing-plan-draw" d="m57 12 2-7m8 9 5-6m-21 6-4-5" pathLength="1" />
      </svg>
    </div>
  );
}

function FeatureList({ groups }: { groups: readonly PricingFeatureGroup[] }) {
  return (
    <div className="pricing-feature-list mt-4 flex flex-col gap-4 border-t border-[#E8EAF1] pt-4">
      {groups.map((group, groupIndex) => (
        <div className="pricing-feature-group" key={group.title ?? `features-${groupIndex}`}>
          {group.title ? (
            <h3 className="mb-4 text-[13px] font-extrabold leading-none text-[#11172F]">
              {group.title}
            </h3>
          ) : null}
          <ul className="flex flex-col gap-[0.48rem] text-[12.75px] leading-[1.45] text-[#2F3B67]">
            {group.items.map((feature) => (
              <li key={feature} className="pricing-feature-item flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#DDF7E9] text-[10px] font-black text-[#18A765]"
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
  className = "",
  showPlanArtwork = false,
}: PricingCardProps) {
  const isGrowth = plan.id === "growth";
  const isPro = plan.id === "pro";
  const ctaColorClassName = isGrowth
    ? "bg-[#E6A100] text-[#1B243B] shadow-[0_14px_24px_rgba(230,161,0,0.2)] hover:bg-[#C98600] focus:ring-[#FCE7A7]"
    : isPro
      ? "bg-[#1F5CFF] text-white shadow-[0_14px_24px_rgba(31,92,255,0.2)] hover:bg-[#1748D1] focus:ring-[#BFDBFE]"
      : "bg-[#6647F0] text-white shadow-[0_14px_24px_rgba(102,71,240,0.2)] hover:bg-[#5636D8] focus:ring-[#DDD6FE]";
  const ctaClassName = `pricing-card-cta mt-auto inline-flex h-11 w-full items-center justify-center rounded-lg px-5 text-[15px] font-bold transition-colors duration-200 focus:outline-none focus:ring-4 ${ctaColorClassName} disabled:cursor-not-allowed disabled:bg-gray-400 disabled:text-white disabled:shadow-none`;
  const cardClassName = isGrowth
    ? "border border-[#F0B400] bg-[#FFF9E8] shadow-[0_24px_60px_rgba(184,130,0,0.10)]"
    : isPro
      ? "border border-[#A7DDF8] bg-[#F7FCFF] shadow-[0_24px_58px_rgba(14,165,233,0.09)]"
      : "border border-[#E1E3EC] bg-white shadow-[0_22px_58px_rgba(20,32,65,0.07)]";
  const badgeClassName = isPro
    ? "bg-[#DDF5FF] text-[#075DFF]"
    : "bg-[#FFE08C] text-[#B37400]";

  return (
    <article
      className={`group relative flex min-h-[530px] flex-col rounded-[14px] p-6 text-left ${cardClassName} ${className}`}
    >
      {showPlanArtwork ? <PlanArtwork planId={plan.id} /> : null}
      <div className="relative flex flex-1 flex-col">
        <div className="mb-2 flex min-h-[25px] justify-center">
          {plan.badge ? (
            <span className={`inline-flex h-6 items-center rounded-full px-4 text-[11px] font-extrabold uppercase tracking-[0.12em] ${badgeClassName}`}>
              {plan.badge}
            </span>
          ) : null}
        </div>

        <div className="flex items-start gap-4">
          <PlanIcon planId={plan.id} />
          <div className="min-w-0 pt-2">
            <h2 className="text-[19px] font-extrabold leading-none text-[#0B1433]">
              {plan.name}
            </h2>
            <p className="mt-3 min-h-[3rem] text-[13px] font-medium leading-[1.5] text-[#37446D]">
              {plan.description}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-end gap-3">
          <span className="text-[36px] font-extrabold leading-none tracking-tight text-[#050912]">
            ${plan.price}
          </span>
          <span className="pb-1 text-[13px] font-semibold text-[#34406A]">
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
  "No Monthly Subscriptions",
  "Lifetime Access",
  "Recruiter Dashboard Included",
  "Built for Growing Teams",
] as const;

export function PricingTrustSection() {
  return (
    <section
      aria-label="Pricing trust details"
      className="mt-10 grid grid-cols-1 gap-4 border-t border-[#EEF0F6] pt-7 text-center sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
    >
      {trustItems.map((item) => (
        <div
          key={item}
          className="flex items-center justify-center gap-3 text-[13px] font-semibold text-[#34406A]"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#DDF7E9] text-[11px] font-black text-[#18A765]"
          >
            {"\u2713"}
          </span>
          <span>{item}</span>
        </div>
      ))}
    </section>
  );
}
