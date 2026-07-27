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
    name: "Next.js",
    className:
      "text-4xl font-black rotate-[-3deg] md:left-[9%] md:top-[33%]",
  },
  {
    name: "Tailwind CSS",
    className:
      "text-xl font-bold rotate-[4deg] md:right-[9%] md:top-[18%]",
  },
  {
    name: "Supabase",
    className:
      "text-3xl font-extrabold rotate-[-2deg] md:left-[41%] md:top-[43%]",
  },
  {
    name: "Stripe",
    className:
      "text-2xl font-bold rotate-[3deg] md:right-[16%] md:top-[58%]",
  },
  {
    name: "Razorpay",
    className:
      "text-lg font-extrabold rotate-[-4deg] md:left-[18%] md:bottom-[14%]",
  },
];

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
            Find Your Dream Job
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-gray-500">
            Browse high-quality jobs from top companies
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
              Not just another job board.
            </h2>
            <p className="mt-5 text-base leading-7 text-gray-500 sm:text-lg sm:leading-8">
              This platform wasn’t built to be just another job listing site. It
              was created to simplify how hiring and job searching actually work.
            </p>
            <p className="mt-4 text-base leading-7 text-gray-500 sm:text-lg sm:leading-8">
              Built using modern technologies like Next.js and Tailwind CSS, this
              job board focuses on speed, simplicity, and a clean experience —
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

          <div className="mx-auto mt-12 max-w-[650px] text-center">
            <h3 className="text-2xl font-bold tracking-tight text-gray-900">
              Built with technologies trusted by modern startups.
            </h3>
            <p className="mt-3 text-base leading-7 text-gray-500">
              Chosen for speed, scalability, security and an excellent developer
              experience.
            </p>
          </div>

          <div className="relative mt-8 overflow-hidden rounded-3xl border border-yellow-300/60 bg-[#FFF3B0]/40 p-6 text-left shadow-[0_34px_100px_rgba(120,75,12,0.18)] transition-all duration-300 hover:shadow-2xl sm:p-8">
            <div className="pointer-events-none absolute -right-10 -top-12 h-56 w-56 rounded-full bg-yellow-300/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-white/80 blur-3xl" />
            <div className="pointer-events-none absolute left-[8%] top-[16%] hidden h-[64%] w-[84%] rotate-[-7deg] rounded-[44%_56%_49%_51%/55%_45%_59%_41%] border border-yellow-800/40 md:block" />
            <div className="pointer-events-none absolute left-[11%] top-[21%] hidden h-[52%] w-[75%] rotate-[6deg] rounded-[56%_44%_53%_47%/43%_57%_41%_59%] border border-yellow-900/25 md:block" />

            <div className="pointer-events-none absolute left-[7%] top-[16%] hidden h-1.5 w-1.5 rounded-full bg-yellow-800/30 md:block" />
            <div className="pointer-events-none absolute left-[28%] top-[20%] hidden h-1 w-1 rounded-full bg-yellow-800/25 md:block" />
            <div className="pointer-events-none absolute right-[14%] top-[32%] hidden h-1.5 w-1.5 rounded-full bg-yellow-800/25 md:block" />
            <div className="pointer-events-none absolute left-[35%] bottom-[18%] hidden h-1 w-1 rounded-full bg-yellow-800/25 md:block" />
            <div className="pointer-events-none absolute right-[30%] bottom-[22%] hidden h-1.5 w-1.5 rounded-full bg-yellow-800/25 md:block" />
            <div className="pointer-events-none absolute right-[8%] bottom-[16%] hidden h-1 w-1 rounded-full bg-yellow-800/25 md:block" />
            <div className="pointer-events-none absolute left-[17%] top-[25%] hidden text-sm font-bold text-yellow-900/30 md:block">
              +
            </div>
            <div className="pointer-events-none absolute right-[22%] bottom-[30%] hidden text-sm font-bold text-yellow-900/25 md:block">
              +
            </div>
            <div className="pointer-events-none absolute right-[36%] top-[17%] hidden text-base font-black text-yellow-900/25 md:block">
              *
            </div>
            <div className="pointer-events-none absolute left-[9%] bottom-[31%] hidden text-base font-black text-yellow-900/20 md:block">
              *
            </div>
            <div className="pointer-events-none absolute bottom-[12%] right-[16%] hidden h-10 w-12 rounded-br-full border-b border-r border-yellow-900/25 md:block" />

            <div className="relative">
              <p className="inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-900">
                TECH STACK
              </p>

              <div className="relative mt-8 grid gap-6 sm:grid-cols-2 md:block md:h-[340px]">
                <span className="pointer-events-none absolute left-[14%] top-[23%] hidden text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700/35 md:block">
                  Framework
                </span>
                <span className="pointer-events-none absolute right-[17%] top-[10%] hidden text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700/35 md:block">
                  Styling
                </span>
                <span className="pointer-events-none absolute left-[45%] top-[35%] hidden text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700/35 md:block">
                  Database
                </span>
                <span className="pointer-events-none absolute right-[20%] top-[50%] hidden text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700/35 md:block">
                  Payments
                </span>
                <span className="pointer-events-none absolute left-[20%] bottom-[8%] hidden text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700/35 md:block">
                  Scalable
                </span>
                <span className="pointer-events-none absolute right-[41%] bottom-[18%] hidden text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700/35 md:block">
                  Performance
                </span>
                {techItems.map((tech) => (
                  <div
                    key={tech.name}
                    className={`flex items-center gap-3 text-gray-900 drop-shadow-sm transition-all duration-300 hover:scale-105 hover:text-black md:absolute ${tech.className}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-yellow-700/20 bg-white/70 text-xs font-black text-gray-900 shadow-[0_8px_18px_rgba(120,75,12,0.12)]">
                      {tech.name.charAt(0)}
                    </span>
                    <span>{tech.name}</span>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-center text-sm font-medium text-gray-700 md:mt-0">
                Built with a modern startup stack
              </p>
              <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                Fast Frontend • Secure Payments • Scalable Backend
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
