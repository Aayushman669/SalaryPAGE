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
  formatPublicJobSalary,
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

function JobCard({ job }: { job: PublicJobListItem }) {
  const companyInitial = job.companyName.trim().charAt(0).toUpperCase() || "J";

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(17,24,39,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(17,24,39,0.12)] sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-base font-bold text-white shadow-[0_10px_24px_rgba(17,24,39,0.18)]">
            {companyInitial}
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900">
              {job.title}
            </h2>
            <p className="mt-2 text-sm font-medium text-gray-500">
              {job.companyName}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-5 sm:min-w-48 sm:border-t-0 sm:pt-0">
          <p className="text-lg font-bold tracking-tight text-gray-900">
            {formatPublicJobSalary(job.salary)}
          </p>
          <span className="rounded-full bg-yellow-50 px-3 py-2 text-xs font-semibold text-gray-900 ring-1 ring-yellow-200">
            Open
          </span>
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
      <div className="mt-12 w-full rounded-xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)] sm:mt-14">
        <p className="text-base font-semibold text-gray-700">
          Loading jobs...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-12 w-full rounded-xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)] sm:mt-14">
        <h2 className="text-lg font-bold text-gray-900">
          Jobs are unavailable
        </h2>
        <p className="mt-3 text-sm leading-6 text-gray-500">{error}</p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="mt-12 w-full rounded-xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)] sm:mt-14">
        <h2 className="text-lg font-bold text-gray-900">
          No jobs available
        </h2>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          There are no published jobs to show right now.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 flex w-full max-w-3xl flex-col gap-4 sm:mt-12">
      {jobs.map((job) => (
        <JobCard key={job.slug} job={job} />
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

    return () => observer.disconnect();
  }, []);

  function scrollToSection(sectionId: SectionId) {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-white px-5 py-8 text-gray-900 sm:px-8 sm:py-12 lg:px-12">
      <StructuredData data={createHomeStructuredData()} />
      <nav className="fixed inset-x-4 top-4 z-20 mx-auto flex max-w-md items-center justify-start gap-2 overflow-x-auto rounded-full border border-gray-200 bg-white/90 px-2 py-3 shadow-[0_18px_55px_rgba(17,24,39,0.12)] backdrop-blur-xl sm:inset-x-auto sm:right-8 sm:mx-0 sm:w-fit sm:max-w-none sm:justify-center sm:gap-8 sm:px-6 lg:right-12">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
              className="group relative rounded-lg px-1 py-1 text-xs font-semibold text-gray-500 transition-colors duration-200 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 sm:px-2 sm:text-sm"
            >
              {item.label}
              <span
                className={`absolute inset-x-0 -bottom-1 h-0.5 origin-center rounded-full bg-yellow-500 transition-transform duration-300 ease-out ${
                  isActive ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </button>
          );
        })}
        {isLoggedIn ? (
          <button
            type="button"
            onClick={logout}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-black px-3 text-xs font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_12px_28px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200 sm:px-4 sm:text-sm"
          >
            Logout
          </button>
        ) : (
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-xl bg-black px-3 text-xs font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_12px_28px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200 sm:px-4 sm:text-sm"
          >
            Login
          </Link>
        )}
      </nav>

      <section
        id="home"
        className="mx-auto flex min-h-screen w-full max-w-5xl scroll-mt-28 flex-col items-center justify-center py-28 sm:py-32"
      >
        <div className="max-w-3xl text-center">
          <div className="mx-auto mb-6 inline-flex rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
            Curated hiring, simplified
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Forge Your Future Career
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-gray-500">
            Discover jobs, connect with recruiters, and build your future with JobForge.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#jobs"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-black px-6 text-sm font-bold text-white shadow-[0_14px_35px_rgba(17,24,39,0.22)] transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_18px_40px_rgba(17,24,39,0.22)] focus:outline-none focus:ring-4 focus:ring-yellow-200 sm:w-auto"
            >
              Explore Jobs
            </a>
            <a
              href="/post-job"
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-gray-900 bg-white px-6 text-sm font-bold text-gray-900 shadow-[0_12px_30px_rgba(17,24,39,0.06)] transition-all duration-200 hover:bg-yellow-50 focus:outline-none focus:ring-4 focus:ring-yellow-200 sm:w-auto"
            >
              Post a Job
            </a>
          </div>
        </div>

        <div
          id="jobs"
          className="mt-16 flex w-full max-w-3xl scroll-mt-28 items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-5 py-4"
        >
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Latest jobs
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Hand-picked roles from published companies
            </p>
          </div>
        </div>

        <JobsGrid error={error} isLoading={isLoading} jobs={jobs} />
      </section>

      <section
        id="about"
        className="mx-auto flex min-h-screen w-full scroll-mt-28 flex-col items-center justify-center border-t border-gray-100 py-28 text-center dark:border-gray-800 sm:py-32"
      >
        <div className="mx-auto w-full max-w-6xl rounded-[2rem] border border-gray-200/70 bg-[#FEFEFC] px-8 py-10 shadow-[0_26px_75px_rgba(0,0,0,0.07)] sm:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Not just another hiring platform.
            </h2>
            <p className="mt-5 text-base leading-7 text-gray-500 sm:text-lg sm:leading-8">
              This platform wasn’t built to be just another job listing site. It
              was created to simplify how hiring and job searching actually work.
            </p>
            <p className="mt-4 text-base leading-7 text-gray-500 sm:text-lg sm:leading-8">
              Built using modern technologies like Next.js and Tailwind CSS, JobForge
              focuses on speed, simplicity, and a clean experience —
              without unnecessary clutter.
            </p>
          </div>

          <div className="mt-10 grid gap-5 text-left md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-[0_20px_55px_rgba(17,24,39,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_70px_rgba(17,24,39,0.10)]">
              <p className="inline-flex rounded-full bg-yellow-500 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-gray-900">
                This is for:
              </p>
              <ul className="mt-5 list-disc space-y-3 pl-5 text-base leading-7 text-gray-500">
                <li>Startups and companies who want to hire faster</li>
                <li>
                  Individuals who are serious about finding real opportunities
                </li>
                <li>People who value simplicity and efficiency</li>
              </ul>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-[0_20px_55px_rgba(17,24,39,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_70px_rgba(17,24,39,0.10)]">
              <p className="inline-flex rounded-full border border-yellow-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-gray-900">
                This is NOT for:
              </p>
              <ul className="mt-5 list-disc space-y-3 pl-5 text-base leading-7 text-gray-500">
                <li>Spam job posters</li>
                <li>Low-quality listings</li>
                <li>People just casually browsing without intent</li>
              </ul>
            </div>
          </div>

          <p className="mt-10 text-center text-base font-bold leading-7 text-gray-900 sm:text-lg">
            Built with one goal — quality over quantity.
          </p>

          <div className="relative mx-auto mt-10 max-w-5xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-[#151619] p-5 text-left text-[#f5f5f5] shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-6 lg:p-7">
            <div className="pointer-events-none absolute -right-48 top-8 hidden h-[27rem] w-[42rem] rounded-[50%] border border-yellow-400/10 md:block" />
            <div className="pointer-events-none absolute -left-56 bottom-20 hidden h-[19rem] w-[34rem] rounded-[50%] border border-yellow-400/10 md:block" />

            <div className="relative">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-300">
                <StackGlyph name="layers" />
                Tech Stack
              </p>
              <h3 className="mt-4 max-w-3xl text-2xl font-bold tracking-tight text-[#f5f5f5] sm:text-3xl">
                Built with <span className="text-yellow-300">modern technologies</span>
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
                Chosen for speed, scalability, security and an excellent developer
                experience.
              </p>

              <div className="mt-6 grid gap-3 lg:grid-cols-3">
                {techItems.slice(0, 3).map((tech) => (
                  <article
                    key={tech.name}
                    className="group h-full rounded-xl border border-yellow-400/25 bg-white/[0.03] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-yellow-300/60 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-[#101114] text-2xl font-black shadow-[0_12px_24px_rgba(0,0,0,0.25)] transition-transform duration-200 group-hover:scale-105">
                        <TechBrandMark brand={tech.brand} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-300">
                          {tech.category}
                        </span>
                        <span className="mt-1.5 block text-xl font-bold tracking-tight text-[#f5f5f5]">
                          {tech.name}
                        </span>
                        <span className="mt-1 block text-[13px] leading-5 text-white/55">
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
                    className="group h-full rounded-xl border border-yellow-400/25 bg-white/[0.03] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-yellow-300/60 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-[#101114] text-2xl font-black shadow-[0_12px_24px_rgba(0,0,0,0.25)] transition-transform duration-200 group-hover:scale-105">
                        <TechBrandMark brand={tech.brand} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-300">
                          {tech.category}
                        </span>
                        <span className="mt-1.5 block text-xl font-bold tracking-tight text-[#f5f5f5]">
                          {tech.name}
                        </span>
                        <span className="mt-1 block text-[13px] leading-5 text-white/55">
                          {tech.description}
                        </span>
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-6 grid divide-y divide-white/15 rounded-xl border border-yellow-400/25 bg-white/[0.03] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {capabilityItems.map((item) => (
                  <div key={item.title} className="flex items-center gap-3 px-4 py-4 sm:px-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-yellow-400/30 bg-yellow-400/10 text-yellow-300">
                      <StackGlyph name={item.icon} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-yellow-300">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-white/55">
                        {item.description}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/55">
                <span className="text-yellow-300"><StackGlyph name="rocket" /></span>
                Built with performance, security and scalability in mind.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className="mx-auto flex min-h-screen w-full scroll-mt-28 flex-col items-center justify-center border-t border-gray-100 py-28 text-center sm:py-32"
      >
        <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-gray-200 bg-[#FFFDF7] p-8 shadow-[0_30px_90px_rgba(17,24,39,0.10)] dark:border-gray-700 dark:bg-[#121214] sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-yellow-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-16 h-56 w-56 rounded-full bg-yellow-500/10 blur-3xl" />

          <div className="mx-auto max-w-2xl">
            <p className="inline-flex rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-900 dark:border-yellow-400/50 dark:bg-yellow-400/10 dark:text-gray-100">
              Simple one-time pricing
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
              Pricing
            </h2>
            <p className="mt-5 text-lg leading-8 text-gray-500 dark:text-gray-400">
              Choose a simple plan when you are ready to post jobs and reach
              high-quality candidates.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              {[
                "One-time payment",
                "Secure checkout",
                "Instant access after payment",
              ].map((detail) => (
                <span key={detail} className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  {detail}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-14 grid items-stretch gap-6 md:grid-cols-3">
            <PricingCard plan={plans[0]} ctaHref="/pricing" />
            <PricingCard plan={plans[1]} ctaHref="/pricing" />
            <PricingCard plan={plans[2]} ctaHref="/pricing" />
          </div>

          <PricingTrustSection />

          <p className="mt-8 text-center text-sm font-medium text-gray-500">
            Need more hiring volume? Upgrade anytime.
          </p>
        </div>
      </section>
    </main>
  );
}
