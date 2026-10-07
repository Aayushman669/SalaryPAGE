"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { PricingCard, PricingTrustSection } from "./pricing/pricing-card";
import { plans } from "@/lib/plans";
import StructuredData from "@/app/structured-data";
import { createHomeStructuredData } from "@/lib/structured-data";
import {
  fetchPublicJobs,
  formatPostedTime,
  formatPublicJobEmploymentType,
  formatPublicJobExperience,
  formatPublicJobSalary,
  formatPublicJobWorkplaceType,
  type PublicJobListItem,
} from "@/lib/public-jobs";

type SectionId = "home" | "about" | "pricing";

const navItems: { id: SectionId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "pricing", label: "Pricing" },
];

const techItems = [
  {
    category: "FRAMEWORK",
    description: "The React framework for production.",
    brand: "next",
    name: "Next.js",
  },
  {
    category: "DATABASE",
    description: "Open source Firebase alternative.",
    brand: "supabase",
    name: "Supabase",
  },
  {
    category: "STYLING",
    description: "Utility-first CSS framework for rapid UI development.",
    brand: "tailwind",
    name: "Tailwind CSS",
  },
  {
    category: "PAYMENTS",
    description: "Online payments for internet businesses.",
    brand: "stripe",
    name: "Stripe",
  },
  {
    category: "SCALABLE",
    description: "Powerful payment solutions for India.",
    brand: "razorpay",
    name: "Razorpay",
  },
] as const;

const capabilityItems = [
  {
    description: "Optimized for speed and performance",
    icon: "lightning",
    title: "Fast Frontend",
  },
  {
    description: "Bank-grade security for all transactions",
    icon: "shield",
    title: "Secure Payments",
  },
  {
    description: "Built to scale with your business",
    icon: "layers",
    title: "Scalable Backend",
  },
] as const;

function StackGlyph({
  name,
}: {
  name: "layers" | "lightning" | "rocket" | "shield";
}) {
  const pathClassName = "fill-none stroke-current stroke-2";

  if (name === "lightning") {
    return (
      <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path className={pathClassName} d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path className={pathClassName} d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z" strokeLinecap="round" strokeLinejoin="round" />
        <path className={pathClassName} d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "rocket") {
    return (
      <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path className={pathClassName} d="M14.5 9.5 4 20l-.5-4.5L14 5c2.4-2.4 5.4-3.1 7-3 .1 1.6-.6 4.6-3 7Z" strokeLinecap="round" strokeLinejoin="round" />
        <path className={pathClassName} d="m8 16-3 1-1 3 3-1 1-3Zm8-8h.01M12 12l-2 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
      <path className={pathClassName} d="m12 3 8 4-8 4-8-4 8-4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path className={pathClassName} d="m4 12 8 4 8-4M4 17l8 4 8-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TechBrandMark({
  brand,
}: {
  brand: "next" | "razorpay" | "stripe" | "supabase" | "tailwind";
}) {
  if (brand === "tailwind") {
    return (
      <svg aria-hidden="true" className="h-9 w-9 text-cyan-300" fill="none" viewBox="0 0 32 24">
        <path d="M2 12c3.5-6 7.5-6 11 0s7.5 6 11 0 4.5-6 6-6" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        <path d="M2 20c3.5-6 7.5-6 11 0s7.5 6 11 0 4.5-6 6-6" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      </svg>
    );
  }

  if (brand === "stripe") {
    return (
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#635bff] text-3xl font-black leading-none text-[#ffffff]">
        S
      </span>
    );
  }

  if (brand === "next") {
    return (
      <span aria-hidden="true" className="relative text-3xl font-black leading-none text-[#f5f5f5]">
        N<span className="absolute -right-1 top-0 h-9 w-px rotate-[34deg] bg-yellow-300" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`text-3xl font-black leading-none ${brand === "supabase" ? "text-emerald-300" : "text-[#f5f5f5]"}`}
    >
      {brand === "supabase" ? "S" : "R"}
    </span>
  );
}

function HeroArtwork() {
  return (
    <div aria-hidden="true" className="hero-artwork pointer-events-none absolute inset-x-0 top-[11.5rem] z-0 mx-auto h-[33rem] w-full max-w-[1536px]">
      <svg className="h-full w-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1536 520">
        <g className="hero-art-details">
          <path className="hero-cloud-outline" d="M71 78c3-19 20-30 37-24 7-23 41-26 51-3 16-8 34 4 34 21 15-3 28 7 29 22 17-2 31 9 31 23 0 8-5 15-14 16H93c-19 0-31-11-31-24 0-16 10-27 29-31Z" />
          <path className="hero-cloud-outline hero-cloud-outline-right" d="M1316 152c3-15 17-24 31-19 6-19 33-21 41-2 13-7 28 3 28 17 12-2 23 6 24 18 13-2 25 7 25 19 0 7-5 12-13 13h-121c-16 0-26-9-26-20 0-13 9-22 24-26Z" />
          <path className="hero-detail-stroke" d="M278 97c8-8 15-8 22 0m-3-8c7 0 12 3 14 10M368 257c7-7 14-7 20 0m-6-7c7 0 11 3 13 8m-94 88c8-8 15-8 22 0m-3-8c7 0 12 3 14 10M1101 147c8-8 15-8 22 0m-3-8c7 0 12 3 14 10" />
        </g>

        <g className="hero-flight hero-flight-left">
          <path className="hero-draw-path hero-draw-left" d="M267 371c-93 3-137-40-128-94 7-43 52-78 88-66 43 14 24 55-5 55-31 0-43-28-25-59 15-25 41-39 61-65" pathLength="1" />
          <path className="hero-draw-path hero-plane-left" d="m270 129 63-31-24 61-22-20-17-10Zm17 10 22 20m-22-20 32-27m-32 27-5 28" pathLength="1" />
          <path className="hero-draw-path hero-plane-left" d="m239 179 16-12-6 20m-10-8 10 0" pathLength="1" />
        </g>

        <g className="hero-flight hero-flight-right">
          <path className="hero-draw-path hero-draw-right" d="M1063 359c35-42 92-43 111-90 19-48-9-76 33-100 27-15 57-29 79-66" pathLength="1" />
          <path className="hero-draw-path hero-plane-right" d="m1190 102 61-32-26 62-20-20-15-10Zm15 10 20 20m-20-20 31-28m-31 28-5 26" pathLength="1" />
          <path className="hero-draw-path hero-plane-right" d="m1150 179 18-13-7 21m-11-8 11 0" pathLength="1" />
          <path className="hero-detail-stroke hero-right-spark" d="m1090 163 4-10m11 13 9-8m-25 1-9-5" />
        </g>

        <g className="hero-journey">
          <path className="hero-draw-path hero-draw-journey" d="M259 383c77 0 84 6 138 2 59-4 89 10 137 2 48-8 71-11 115 0 45 12 72-6 103-3 39 4 55-34 91-35 26-1 35 10 56 5" pathLength="1" />
          <path className="hero-draw-path hero-journey-arrow" d="m898 350 15 4-11 10" pathLength="1" />
          <circle className="hero-journey-node" cx="488" cy="387" r="5" />
          <circle className="hero-journey-node" cx="685" cy="383" r="5" />
          <circle className="hero-journey-node" cx="820" cy="349" r="5" />

          <g className="hero-stage hero-stage-1">
            <circle className="hero-stage-circle" cx="343" cy="383" r="34" />
            <path className="hero-stage-icon" d="M329 385c0-8 6-14 14-14s14 6 14 14m-31 20c2-10 9-15 17-15s15 5 17 15m-25-23c-3-4-2-9 2-12m17 12c3-4 2-9-2-12" />
            <text className="hero-art-label" x="343" y="447" textAnchor="middle">Find Opportunities</text>
          </g>
          <g className="hero-stage hero-stage-2">
            <circle className="hero-stage-circle hero-stage-circle-blue" cx="661" cy="383" r="34" />
            <path className="hero-stage-icon" d="M649 365h20l7 7v29h-27v-36Zm20 0v8h7m-19 6h12m-12 7h12m-12 7h8" />
            <text className="hero-art-label" x="661" y="447" textAnchor="middle">Apply Easily</text>
          </g>
          <g className="hero-stage hero-stage-3">
            <circle className="hero-stage-circle hero-stage-circle-peach" cx="962" cy="369" r="34" />
            <path className="hero-stage-icon" d="M946 365h32v27h-32v-27Zm7 0v-5h18v5m-12 10h6" />
            <text className="hero-art-label" x="962" y="433" textAnchor="middle">Get Hired</text>
          </g>
        </g>

        <g className="hero-city">
          <path className="hero-city-line" d="M1110 432h324m-293 0v-82h35v82m-35-52h35m-23-30v-28h11v28m39 162v-143h43v143m-27-120h11v10h-11v-10Zm0 24h11v10h-11v-10Zm0 24h11v10h-11v-10Zm0 24h11v10h-11v-10Zm47 48v-105h43v105m-27-86h11v10h-11v-10Zm0 24h11v10h-11v-10Zm0 24h11v10h-11v-10Zm48 38V266h39v166m-25-144h11v10h-11v-10Zm0 24h11v10h-11v-10Zm0 24h11v10h-11v-10Zm0 24h11v10h-11v-10Zm54 62v-173h48v173m-30-150h12v10h-12v-10Zm0 24h12v10h-12v-10Zm0 24h12v10h-12v-10Zm0 24h12v10h-12v-10Zm48 78V316h49v116m-32-96h12v10h-12v-10Zm0 24h12v10h-12v-10Zm0 24h12v10h-12v-10Zm-196 39c-4-18 2-31 15-40m-13 40c4-18 2-31-10-40m183 40c-3-18 4-32 17-43m-14 43c3-17 1-30-11-40" />
          <path className="hero-cloud-outline hero-city-cloud" d="M1268 398c3-14 15-22 28-18 6-18 30-20 37-2 13-6 26 3 27 16 12-2 22 6 22 17h-117c-13 0-22-7-22-17 0-9 8-16 25-16Z" />
          <path className="hero-city-ground" d="M1080 435c97-9 223-8 370 2" />
        </g>
      </svg>
    </div>
  );
}

function JobsEmptyIllustration() {
  return (
    <svg aria-hidden="true" className="empty-jobs-illustration" fill="none" viewBox="0 0 440 210">
      <path className="empty-jobs-wash" d="M148 154c-13-35 14-78 58-91 46-13 90 10 102 49 13 44-22 75-69 81-44 5-79-5-91-39Z" />
      <path className="empty-jobs-dotted" d="M57 169c35-18 64-27 90-22 27 6 45 22 76 22 29 0 62-21 101-23 38-2 66 10 82 25" />
      <path className="empty-jobs-folder" d="M144 111h51l15 14h70v50h-136v-64Zm0 14h136" />
      <path className="empty-jobs-folder" d="M214 140c0-15 12-27 27-27s27 12 27 27-12 27-27 27-27-12-27-27Zm42 21 20 20" />
      <path className="empty-jobs-plane" d="m362 88 34-16-13 34-11-11-10-7Zm10 7 11 11m-11-11 18-16" />
      <path className="empty-jobs-spark" d="m184 93 4-10m12 13 9-7m-27 3-9-5" />
    </svg>
  );
}

function AboutArtwork() {
  return (
    <div aria-hidden="true" className="about-artwork">
      <svg className="h-full w-full" fill="none" viewBox="0 0 1000 260">
        <g className="about-doodle about-doodle-left">
          <path className="about-detail-stroke" d="m33 143 20-25m-17 31 14-1m-10-13-1-12" />
          <path className="about-cloud-outline" d="M915 155c2-12 13-19 24-15 5-15 26-17 32-2 11-5 22 2 23 13 10-2 18 5 18 14H906c-11 0-18-6-18-14 0-7 6-13 15-15Z" />
        </g>
        <g className="about-doodle about-doodle-right">
          <path className="about-detail-stroke" d="m944 45 9-7m9 13 10-5m-3 15 9-1m-3 24 8-4m-19 7 7 5" />
          <path className="about-bird" d="M960 24c6-6 12-6 18 0m14 12c5-5 10-5 15 0" />
        </g>

        <path className="about-draw-path about-journey-path" d="M122 139c82 48 157 49 241 34 58-10 91 17 137 1 44-15 79-12 124 1 47 14 86 3 126-14 35-14 63-22 108-8" pathLength="1" />
        <path className="about-draw-path about-journey-arrow about-journey-arrow-left" d="m121 139 14-2-7 11" pathLength="1" />
        <path className="about-draw-path about-journey-arrow about-journey-arrow-right" d="m858 152 12-7-2 13" pathLength="1" />
        <path className="about-draw-path about-journey-loop" d="M494 169c-12-13-12-28 0-35 13-7 24 4 20 15-4 12-18 13-26 2" pathLength="1" />

        <g className="about-art-node about-candidate">
          <circle className="about-person-head" cx="89" cy="78" r="22" />
          <path className="about-person-hair" d="M67 77c-2-13 7-27 22-27 16 0 25 13 22 28m-42-7c-7-1-9-12-1-15m42 16c8-3 8-13 1-16" />
          <path className="about-person-face" d="M80 78h.1m18 0h.1m-16 9c4 4 9 4 14 0" />
          <path className="about-person-body" d="M57 134c1-24 13-36 32-36s31 12 32 36m-52-3h40" />
          <path className="about-detail-stroke" d="m52 45-9-8m15 0-3-13m14 9 3-11" />
        </g>

        <g className="about-art-node about-briefcase">
          <path className="about-briefcase-line" d="M853 81h78v52h-78V81Zm14 0v-9c0-6 5-11 11-11h28c6 0 11 5 11 11v9m-64 22h78m-44-9h10v12h-10V94Z" />
          <path className="about-detail-stroke" d="m846 68-8-9m23-8 2-12m31 17 8-11m17 25 11-7" />
        </g>
      </svg>
    </div>
  );
}

function PricingArtwork() {
  return (
    <div aria-hidden="true" className="pricing-artwork">
      <svg className="h-full w-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1240 560">
        <g className="pricing-cloud-mass pricing-cloud-mass-left">
          <path className="pricing-cloud-outline" d="M20 119c6-31 35-49 63-37 12-39 68-43 84-5 26-13 57 6 57 35 25-5 48 11 50 35 26-4 51 12 51 36 0 14-9 25-25 28H50c-31 0-50-18-50-41 0-25 15-44 42-51Z" />
        </g>
        <g className="pricing-cloud-mass pricing-cloud-mass-right">
          <path className="pricing-cloud-outline" d="M1050 50c4-20 24-32 43-25 8-26 45-29 56-3 17-9 38 4 38 23 17-3 32 7 33 24h-179c-22 0-36-12-36-28 0-15 10-26 28-31Z" />
          <path className="pricing-cloud-outline pricing-cloud-outline-small" d="M1125 124c3-14 16-22 29-17 6-18 32-19 39-2 13-6 27 3 28 16 12-2 23 6 23 18h-122c-13 0-22-8-22-18 0-9 8-16 25-17Z" />
        </g>
        <g className="pricing-tag">
          <path className="pricing-draw-path" d="m91 76 54-42h44l20 20v43l-53 49-65-70Z" pathLength="1" />
          <circle className="pricing-tag-hole" cx="165" cy="57" r="8" />
          <path className="pricing-draw-path pricing-tag-tail" d="M208 118c28 26 37 0 52 11 14 10 25 19 43 7" pathLength="1" />
          <path className="pricing-detail-stroke" d="m80 64-12-10m17 3-2-17m5 31-13 3" />
        </g>
        <g className="pricing-corner-doodle pricing-corner-doodle-left">
          <path className="pricing-dotted-path" d="M44 484c15-18 29-22 43-10 14 12 19 21 31 20" pathLength="1" />
          <path className="pricing-detail-stroke" d="m118 490 8-6m-4 16 9-1" />
        </g>
        <g className="pricing-corner-doodle pricing-corner-doodle-right">
          <path className="pricing-dotted-path" d="M1135 451c13-13 27-13 41 0 12 12 22 13 34 2 10-8 19-5 26 6" pathLength="1" />
          <path className="pricing-detail-stroke" d="m1221 424 5-10m9 13 8-7m-19 0-9-5" />
        </g>
      </svg>
    </div>
  );
}

function JobCard({ job, index }: { job: PublicJobListItem; index: number }) {
  const companyInitial = job.companyName.trim().charAt(0).toUpperCase() || "J";

  return (
    <article
      className="job-card-enter group relative overflow-hidden rounded-2xl border border-[#E6E8F2] bg-white p-5 shadow-[0_18px_45px_rgba(31,41,55,0.07)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[#C7D2FE] hover:shadow-[0_24px_70px_rgba(79,70,229,0.13)] sm:p-6"
      style={{ animationDelay: `${Math.min(index, 5) * 70}ms` }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#7C5CFC] via-[#7DD3FC] to-[#FDBA74] opacity-80" />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#4F46E5] text-base font-bold text-white shadow-[0_14px_30px_rgba(79,70,229,0.24)]">
            {companyInitial}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-[#111827]">
              {job.title}
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#667085]">
              {job.companyName}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#4F46E5] ring-1 ring-[#C7D2FE]/70">
                {formatPublicJobEmploymentType(job.employmentType)}
              </span>
              <span className="rounded-full bg-[#ECFEFF] px-3 py-1 text-xs font-semibold text-[#0E7490] ring-1 ring-[#BAE6FD]/70">
                {formatPublicJobWorkplaceType(job.workplaceType)}
              </span>
              {job.featured ? (
                <span className="rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-semibold text-[#C2410C] ring-1 ring-[#FED7AA]/80">
                  Featured
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#EEF0F6] pt-5 sm:min-w-56 sm:items-end sm:border-t-0 sm:pt-0">
          <p className="text-lg font-bold tracking-tight text-[#111827]">
            {formatPublicJobSalary(job.salary)}
          </p>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-semibold text-[#475467] ring-1 ring-[#E2E8F0]">
              {job.location || "Location not specified"}
            </span>
            <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-semibold text-[#475467] ring-1 ring-[#E2E8F0]">
              {formatPublicJobExperience(job.experienceLevel)}
            </span>
          </div>
          <p className="text-xs font-medium text-[#98A2B3]">
            {formatPostedTime(job.publishedAt ?? job.postedAt)}
          </p>
        </div>
      </div>
    </article>
  );
}

function JobsGrid({
  error,
  isLoading,
  jobs,
}: {
  error: string | null;
  isLoading: boolean;
  jobs: PublicJobListItem[];
}) {
  if (isLoading) {
    return (
      <div className="mt-8 w-full rounded-2xl border border-[#E6E8F2] bg-white/90 p-8 text-center shadow-[0_18px_45px_rgba(31,41,55,0.07)] sm:mt-10">
        <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-2xl bg-[#EEF2FF]" />
        <p className="text-base font-semibold text-[#475467]">
          Loading jobs...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 w-full rounded-2xl border border-[#FECACA] bg-white p-8 text-center shadow-[0_18px_45px_rgba(31,41,55,0.07)] sm:mt-10">
        <h2 className="text-lg font-bold text-[#111827]">
          Jobs are unavailable
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#667085]">{error}</p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="empty-jobs-state mt-8 w-full rounded-[1.75rem] border border-[#ECEAF8] bg-white/80 px-4 pb-7 pt-2 text-center sm:mt-10 sm:px-8">
        <JobsEmptyIllustration />
        <h2 className="-mt-2 text-lg font-bold text-[#111827]">
          No jobs available
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#667085]">
          There are no published jobs to show right now.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 flex w-full flex-col gap-4 sm:mt-10">
      {jobs.map((job, index) => (
        <JobCard index={index} key={job.slug} job={job} />
      ))}
    </div>
  );
}

export default function Home() {
  const { isLoggedIn, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionId>("home");
  const [jobs, setJobs] = useState<PublicJobListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      const result = await fetchPublicJobs({
        category: "",
        employmentType: "",
        experienceLevel: "",
        featured: false,
        location: "",
        page: 1,
        query: "",
        sort: "newest",
        workplaceType: "",
      }, {
        includeCount: false,
        limit: 6,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setJobs(result.jobs);
      }

      setIsLoading(false);
    }

    fetchJobs();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id as SectionId);
          }
        });
      },
      {
        rootMargin: "-100px 0px -100px 0px",
        threshold: 0.5,
      },
    );

    navItems.forEach((item) => {
      const section = document.getElementById(item.id);

      if (section) {
        observer.observe(section);
      }
    });

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.12,
      },
    );

    document.querySelectorAll<HTMLElement>(".reveal-on-scroll").forEach((element) => {
      revealObserver.observe(element);
    });

    return () => {
      observer.disconnect();
      revealObserver.disconnect();
    };
  }, []);

  function scrollToSection(sectionId: SectionId) {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <main className="reference-home min-h-screen overflow-x-hidden bg-white text-[#11142A]">
      <StructuredData data={createHomeStructuredData()} />

      <header className="home-header fixed inset-x-0 top-0 z-30 flex items-center justify-between px-5 pt-4 lg:px-8 lg:pt-5">
        <nav aria-label="Homepage navigation" className="home-nav ml-auto flex items-center gap-1 sm:gap-3 lg:gap-5">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;

            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToSection(item.id);
                }}
                className={`home-nav-item group relative h-11 rounded-2xl px-4 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 focus:outline-none focus:ring-4 focus:ring-[#DDD6FE] sm:px-5 ${
                  isActive ? "home-nav-item-active" : "text-[#40445B] hover:bg-[#FAF8FF] hover:text-[#37218D]"
                }`}
              >
                {item.label}
              </a>
            );
          })}
          {isLoggedIn ? (
            <button
              type="button"
              onClick={logout}
              className="home-auth-button inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7352E8] to-[#5934D1] px-6 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(99,69,217,0.24)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(99,69,217,0.32)] focus:outline-none focus:ring-4 focus:ring-[#DDD6FE]"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="home-auth-button inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7352E8] to-[#5934D1] px-6 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(99,69,217,0.24)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(99,69,217,0.32)] focus:outline-none focus:ring-4 focus:ring-[#DDD6FE]"
            >
              Login
            </Link>
          )}
        </nav>
      </header>

      <section id="home" className="reference-home-hero relative isolate flex min-h-[1024px] w-full scroll-mt-28 flex-col items-center overflow-hidden px-5 pb-10 pt-[6.4rem] sm:px-8 lg:px-10">
        <div className="home-pastel home-pastel-left pointer-events-none absolute -left-32 top-20 -z-10 h-[30rem] w-[32rem]" />
        <div className="home-pastel home-pastel-right pointer-events-none absolute -right-40 top-32 -z-10 h-[30rem] w-[34rem]" />
        <div className="home-pastel home-pastel-bottom-left pointer-events-none absolute -bottom-28 -left-24 -z-10 h-[22rem] w-[34rem]" />
        <div className="home-pastel home-pastel-bottom-right pointer-events-none absolute -bottom-36 -right-28 -z-10 h-[28rem] w-[38rem]" />
        <HeroArtwork />

        <div className="relative z-10 flex w-full max-w-[1060px] flex-col items-center">
          <div className="home-hero-copy text-center">
            <div className="hero-entrance hero-entrance-1 home-eyebrow mx-auto inline-flex items-center gap-2 rounded-full border border-[#ECE6FF] bg-white/90 px-5 py-2 text-sm font-medium text-[#5C39D6] shadow-[0_8px_24px_rgba(84,55,190,0.08)]">
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                <path d="m12 3 1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9L12 3Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
              Curated hiring, simplified
            </div>

            <h1 className="hero-entrance hero-entrance-2 home-headline mt-5 text-[3.65rem] font-extrabold leading-[0.98] tracking-[-0.04em] text-[#11162F] sm:text-[4.75rem] lg:text-[5rem]">
              <span className="block">Forge Your</span>
              <span className="block"><span className="home-future-gradient">Future</span> Career</span>
            </h1>

            <p className="hero-entrance hero-entrance-3 mx-auto mt-6 max-w-[28rem] text-base leading-7 text-[#68708C] sm:text-lg sm:leading-8">
              Discover jobs, connect with recruiters,<br className="hidden sm:block" /> and build your future with JobForge.
            </p>

            <div className="hero-entrance hero-entrance-4 mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#jobs" className="home-primary-cta inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#7352E8] to-[#5934D1] px-8 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(99,69,217,0.24)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(99,69,217,0.32)] focus:outline-none focus:ring-4 focus:ring-[#DDD6FE] sm:w-auto">
                Explore Jobs
              </a>
              <a href="/post-job" className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-[#D7D5E8] bg-white px-8 text-sm font-semibold text-[#15182D] shadow-[0_8px_20px_rgba(34,31,76,0.06)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#BDAEF5] hover:shadow-[0_14px_28px_rgba(99,69,217,0.12)] focus:outline-none focus:ring-4 focus:ring-[#DDD6FE] sm:w-auto">
                Post a Job
              </a>
            </div>
          </div>

          <div id="jobs" className="hero-entrance hero-entrance-5 home-jobs-card mt-[7.85rem] w-full scroll-mt-28 rounded-[1.75rem] border border-[#EBEAF5] bg-white/95 px-5 pb-9 pt-6 shadow-[0_22px_60px_rgba(46,39,97,0.08)] sm:px-9 sm:pt-6">
            <div className="border-b border-[#EEEFF7] pb-4">
              <p className="text-sm font-medium text-[#6A43E6]">Open roles</p>
              <h2 className="mt-2 text-[1.85rem] font-bold tracking-[-0.03em] text-[#11162F]">Latest jobs</h2>
              <p className="mt-2 text-sm leading-6 text-[#68708C]">Hand-picked roles from published companies</p>
            </div>

            <JobsGrid error={error} isLoading={isLoading} jobs={jobs} />
          </div>
        </div>
      </section>

      <section
        id="about"
        className="reference-about-section reveal-on-scroll flex w-full scroll-mt-28 flex-col items-center justify-center px-5 py-24 text-center sm:px-8 sm:py-28 lg:px-12"
      >
        <div className="about-reference-canvas relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/80 bg-white px-6 py-9 shadow-[0_26px_80px_rgba(31,41,55,0.08)] sm:p-10">
          <div className="pointer-events-none absolute -left-28 -top-28 h-64 w-64 rounded-full bg-[#DDD6FE]/60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-0 h-72 w-72 rounded-full bg-[#BAE6FD]/50 blur-3xl" />
          <AboutArtwork />
          <div className="about-copy mx-auto max-w-3xl text-center">
            <h2 className="about-section-heading text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
              Not just another hiring platform.
            </h2>
            <p className="about-section-copy mt-5 text-base leading-7 text-[#667085] sm:text-lg sm:leading-8">
              This platform wasn’t built to be just another job listing site. It
              was created to simplify how hiring and job searching actually work.
            </p>
            <p className="about-section-copy mt-4 text-base leading-7 text-[#667085] sm:text-lg sm:leading-8">
              Built using modern technologies like Next.js and Tailwind CSS, JobForge
              focuses on speed, simplicity, and a clean experience —
              without unnecessary clutter.
            </p>
          </div>

          <div className="about-intent-grid mt-10 grid gap-5 text-left md:grid-cols-2">
            <div className="about-intent-card about-for-card rounded-2xl border border-[#E6E8F2] bg-[#FCFCFF] p-6 shadow-[0_18px_50px_rgba(79,70,229,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C7D2FE] hover:shadow-[0_24px_65px_rgba(79,70,229,0.12)]">
              <p className="about-card-label inline-flex rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-bold text-[#4F46E5] ring-1 ring-[#C7D2FE]/70">
                It is for:
              </p>
              <ul className="about-card-list mt-5 list-disc space-y-3 pl-5 text-base leading-7 text-[#667085]">
                <li>Startups and companies who want to hire faster</li>
                <li>
                  Individuals who are serious about finding real opportunities
                </li>
                <li>People who value simplicity and efficiency</li>
              </ul>
            </div>

            <div className="about-intent-card about-not-card rounded-2xl border border-[#E6E8F2] bg-[#FFFCF8] p-6 shadow-[0_18px_50px_rgba(251,146,60,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FED7AA] hover:shadow-[0_24px_65px_rgba(251,146,60,0.12)]">
              <p className="about-card-label inline-flex rounded-full border border-[#FED7AA] bg-white px-3 py-1 text-xs font-bold text-[#C2410C]">
                It is NOT for:
              </p>
              <ul className="about-card-list mt-5 list-disc space-y-3 pl-5 text-base leading-7 text-[#667085]">
                <li>Spam job posters</li>
                <li>Low-quality listings</li>
                <li>People just casually browsing without intent</li>
              </ul>
            </div>
          </div>

          <p className="about-quality-statement mt-10 text-center text-base font-bold leading-7 text-[#111827] sm:text-lg">
            Built with one goal — <span>quality over quantity.</span>
          </p>

          <svg aria-hidden="true" className="about-quality-art mx-auto mt-5" fill="none" viewBox="0 0 560 50">
            <path className="about-quality-path" d="M26 25c62-12 101 5 152 0 54-6 79-5 113 0 35 5 62 5 97 0 43-6 76 11 146 0" pathLength="1" />
            <path className="about-quality-spark" d="m278 25 8-8 8 8-8 8-8-8Z" />
          </svg>

          <div className="about-tech-preserved relative mx-auto mt-10 max-w-5xl overflow-hidden rounded-3xl border border-[#E6E8F2] bg-gradient-to-br from-white via-[#F8FAFF] to-[#F0FDFA] p-5 text-left text-[#111827] shadow-[0_24px_70px_rgba(31,41,55,0.10)] sm:p-6 lg:p-7">
            <div className="pointer-events-none absolute -right-48 top-8 hidden h-[27rem] w-[42rem] rounded-[50%] border border-[#C7D2FE]/60 md:block" />
            <div className="pointer-events-none absolute -left-56 bottom-20 hidden h-[19rem] w-[34rem] rounded-[50%] border border-[#BAE6FD]/60 md:block" />

            <div className="relative">
              <p className="about-tech-badge inline-flex items-center gap-2 rounded-full border border-[#DDD6FE] bg-white/80 px-3 py-1.5 text-[11px] font-bold text-[#5B21B6] shadow-[0_10px_26px_rgba(79,70,229,0.08)]">
                <StackGlyph name="layers" />
                Tech Stack
              </p>
              <h3 className="about-tech-heading mt-4 max-w-3xl text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
                Built with <span className="text-[#4F46E5]">modern technologies</span>
              </h3>
              <p className="about-tech-description mt-2 max-w-2xl text-sm leading-6 text-[#667085] sm:text-base">
                Chosen for speed, scalability, security and an excellent developer
                experience.
              </p>

              <div className="mt-6 grid gap-3 lg:grid-cols-3">
                {techItems.slice(0, 3).map((tech) => (
                  <article
                    key={tech.name}
                    className="group h-full rounded-2xl border border-[#E6E8F2] bg-white/85 p-4 shadow-[0_14px_32px_rgba(31,41,55,0.06)] transition-all duration-200 hover:-translate-y-1 hover:border-[#C7D2FE] hover:bg-white"
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#E6E8F2] bg-[#111827] text-2xl font-black shadow-[0_12px_24px_rgba(17,24,39,0.16)] transition-transform duration-200 group-hover:scale-105">
                        <TechBrandMark brand={tech.brand} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-bold text-[#7C5CFC]">
                          {tech.category}
                        </span>
                        <span className="mt-1.5 block text-xl font-bold tracking-tight text-[#111827]">
                          {tech.name}
                        </span>
                        <span className="mt-1 block text-[13px] leading-5 text-[#667085]">
                          {tech.description}
                        </span>
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mx-auto mt-3 grid max-w-3xl gap-3 sm:grid-cols-2">
                {techItems.slice(3).map((tech) => (
                  <article
                    key={tech.name}
                    className="group h-full rounded-2xl border border-[#E6E8F2] bg-white/85 p-4 shadow-[0_14px_32px_rgba(31,41,55,0.06)] transition-all duration-200 hover:-translate-y-1 hover:border-[#C7D2FE] hover:bg-white"
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#E6E8F2] bg-[#111827] text-2xl font-black shadow-[0_12px_24px_rgba(17,24,39,0.16)] transition-transform duration-200 group-hover:scale-105">
                        <TechBrandMark brand={tech.brand} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-bold text-[#7C5CFC]">
                          {tech.category}
                        </span>
                        <span className="mt-1.5 block text-xl font-bold tracking-tight text-[#111827]">
                          {tech.name}
                        </span>
                        <span className="mt-1 block text-[13px] leading-5 text-[#667085]">
                          {tech.description}
                        </span>
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-6 grid divide-y divide-[#E6E8F2] rounded-2xl border border-[#E6E8F2] bg-white/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {capabilityItems.map((item) => (
                  <div key={item.title} className="flex items-center gap-3 px-4 py-4 sm:px-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#C7D2FE] bg-[#EEF2FF] text-[#4F46E5]">
                      <StackGlyph name={item.icon} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-[#111827]">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-[#667085]">
                        {item.description}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-[#667085]">
                <span className="text-[#4F46E5]"><StackGlyph name="rocket" /></span>
                Built with performance, security and scalability in mind.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className="reference-pricing-section reveal-on-scroll flex w-full scroll-mt-28 flex-col items-center justify-center bg-white px-5 py-24 text-center sm:px-8 sm:py-28 lg:px-12"
      >
        <div className="pricing-reference-shell relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[#E6E8F2] bg-gradient-to-br from-[#F8FAFF] via-white to-[#FFF7ED] p-6 shadow-[0_30px_90px_rgba(31,41,55,0.09)] sm:p-10">
          <PricingArtwork />
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#C7D2FE]/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-16 h-56 w-56 rounded-full bg-[#BAE6FD]/60 blur-3xl" />

          <div className="pricing-header-content mx-auto max-w-2xl">
            <p className="pricing-kicker inline-flex rounded-full border border-[#DDD6FE] bg-white/85 px-3 py-1 text-xs font-bold text-[#5B21B6] shadow-[0_10px_26px_rgba(79,70,229,0.08)]">
              Simple one-time pricing
            </p>
            <h2 className="pricing-heading mt-4 text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
              Pricing
            </h2>
            <p className="pricing-description mt-5 text-lg leading-8 text-[#667085]">
              Choose a simple plan when you are ready to post jobs and reach
              high-quality candidates.
            </p>
            <div className="pricing-trust-row mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm font-medium text-[#667085]">
              {[
                "One-time payment",
                "Secure checkout",
                "Instant access after payment",
              ].map((detail) => (
                <span key={detail} className="pricing-trust-item inline-flex items-center gap-2">
                  <span className="pricing-trust-dot h-2 w-2 rounded-full bg-[#7C5CFC]" />
                  {detail}
                </span>
              ))}
            </div>
          </div>

          <div className="pricing-card-grid mt-14 grid items-stretch gap-6 md:grid-cols-3">
            <PricingCard className="homepage-pricing-card pricing-card-starter" plan={plans[0]} ctaHref="/pricing" showPlanArtwork />
            <PricingCard className="homepage-pricing-card pricing-card-growth" plan={plans[1]} ctaHref="/pricing" showPlanArtwork />
            <PricingCard className="homepage-pricing-card pricing-card-pro" plan={plans[2]} ctaHref="/pricing" showPlanArtwork />
          </div>

          <PricingTrustSection />

          <p className="pricing-note mt-8 text-center text-sm font-medium text-[#667085]">
            Need more hiring volume? Upgrade anytime.
          </p>
        </div>
      </section>
    </main>
  );
}
