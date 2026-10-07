"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/app/auth-context";
import { getProfile, type ProfileRow } from "@/lib/auth-profiles";
import {
  formatSalary,
} from "@/lib/jobs";
import {
  loadCandidateSavedJobs,
  type SavedJob,
  type SavedJobsFilters,
  type SavedJobsSort,
  type SavedJobsResult,
} from "@/lib/saved-jobs";
import { supabase } from "@/lib/supabase";
import SaveJobButton from "@/app/jobs/save-job-button";
import { BriefcaseIcon, SearchIcon } from "@/app/jobs/jobs-illustrations";
import {
  savedJobChangedEvent,
  SavedJobsProvider,
} from "@/app/jobs/saved-jobs-state";
import {
  SavedJobsDecorations,
  SavedJobsEmptyIllustration,
} from "./saved-jobs-illustrations";
type SavedJobsToolbarSort = SavedJobsSort | "company";

const initialFilters: SavedJobsFilters = {
  employmentType: "",
  location: "",
  search: "",
  sort: "recent",
  workplaceType: "",
};

function formatDate(value: string | null) {
  if (!value) {
    return "Saved recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Saved recently";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function SavedJobsLoading() {
  return (
    <main className="saved-jobs-page">
      <SavedJobsDecorations />
      <section className="saved-jobs-content">
        <div className="saved-jobs-loading-eyebrow animate-pulse" />
        <div className="saved-jobs-loading-heading animate-pulse" />
        <div className="saved-jobs-loading-filter animate-pulse" />
        <div className="mt-7 grid gap-4">
          {[0, 1, 2].map((item) => (
            <div
              aria-hidden="true"
              className="saved-job-card saved-job-card-loading animate-pulse"
              key={item}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function SavedJobsAccessDenied({ recruiter = false }: { recruiter?: boolean }) {
  return (
    <main className="saved-jobs-page saved-jobs-page-centered">
      <SavedJobsDecorations />
      <section className="saved-jobs-access-card">
        <p className="saved-jobs-eyebrow">
          Saved Jobs
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#0B1028]">
          {recruiter ? "Saved Jobs are for Job Seekers" : "Saved Jobs unavailable"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#65708E]">
          {recruiter
            ? "Switch to a Job Seeker account to save and track roles."
            : "Complete onboarding before viewing saved jobs."}
        </p>
        <Link
          className="saved-jobs-dark-button mt-7 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#DDD6FE]"
          href="/dashboard"
        >
          Go to Dashboard
        </Link>
      </section>
    </main>
  );
}

function SavedJobsEmpty({ filtered }: { filtered: boolean }) {
  return (
    <div className="saved-jobs-state-card saved-jobs-empty-state">
      <SavedJobsEmptyIllustration />
      <h2 className="text-2xl font-bold text-[#0B1028]">
        {filtered ? "No matching saved jobs" : "You haven't saved any jobs yet."}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#65708E]">
        {filtered
          ? "Try adjusting your search."
          : "Save interesting roles while you browse and return when you are ready."}
      </p>
      <Link
        className="saved-jobs-dark-button mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#DDD6FE]"
        href={filtered ? "/saved-jobs" : "/jobs"}
      >
        {filtered ? "Clear Search" : "Browse Jobs"}
      </Link>
    </div>
  );
}

function SavedJobCard({ job }: { job: SavedJob }) {
  const available = job.availabilityStatus === "available";

  return (
    <article
      className={`saved-job-card ${
        available ? "saved-job-card-available" : "saved-job-card-unavailable"
      }`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="saved-job-company-avatar">
              {job.companyName.trim().charAt(0).toUpperCase() || "J"}
            </div>
            <div className="min-w-0">
              {available && job.featured ? (
                <span className="saved-job-featured">
                  Featured
                </span>
              ) : null}
              <h2 className="saved-job-title">
                {available && job.jobSlug ? (
                  <Link
                    className="transition-colors duration-200 hover:text-[#5C39D6] focus:outline-none focus:ring-4 focus:ring-[#DDD6FE]"
                    href={`/jobs/${job.jobSlug}`}
                  >
                    {job.jobTitle}
                  </Link>
                ) : (
                  job.jobTitle
                )}
              </h2>
              <p className="saved-job-company">
                {job.companyName}
              </p>
              <p className="saved-job-date">
                Saved {formatDate(job.savedAt)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3 sm:flex-col sm:items-stretch">
            <SaveJobButton
              compact
              jobSlug={job.jobSlug ?? ""}
              jobTitle={job.jobTitle}
            />
            <div className="saved-job-salary">
              <p>
                {available ? formatSalary(job.salary) : "Unavailable"}
              </p>
              {available && job.hasApplied ? (
                <p className="saved-job-applied">
                  Already applied
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {available ? (
          <div className="saved-job-tags">
            {[
              job.location,
              job.employmentType,
              job.workplaceType,
              job.experienceLevel,
            ]
              .filter(Boolean)
              .map((detail) => (
                <span
                  className="saved-job-tag"
                  key={detail}
                >
                  {detail}
                </span>
              ))}
          </div>
        ) : (
          <p className="saved-job-unavailable-copy">
            This job is no longer available. You can remove it from Saved Jobs.
          </p>
        )}

        <div className="saved-job-actions">
          {available && job.jobSlug ? (
            <Link
              className="saved-job-secondary-button"
              href={`/jobs/${job.jobSlug}`}
            >
              View Job
            </Link>
          ) : null}
          {available && job.jobSlug && !job.hasApplied ? (
            <Link
              className="saved-job-primary-button"
              href={`/jobs/${job.jobSlug}`}
            >
              Apply Now
            </Link>
          ) : null}
          {available && job.hasApplied ? (
            <Link
              className="saved-job-applied-button"
              href="/applications"
            >
              View Application
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function SavedJobsPage() {
  const router = useRouter();
  const { isAuthLoading, isLoggedIn } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<SavedJobsFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [sort, setSort] = useState<SavedJobsToolbarSort>(initialFilters.sort);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SavedJobsResult>({
    error: null,
    jobs: [],
    page: 1,
    pageCount: 1,
    totalCount: 0,
  });
  const requestId = useRef(0);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isLoggedIn || !supabase) {
      router.replace(`/login?next=${encodeURIComponent("/saved-jobs")}`);
      return;
    }

    let isMounted = true;

    async function loadProfile() {
      setIsProfileLoading(true);
      const { data, error: userError } = await supabase!.auth.getUser();

      if (userError || !data.user) {
        if (isMounted) {
          setIsProfileLoading(false);
          router.replace(`/login?next=${encodeURIComponent("/saved-jobs")}`);
        }
        return;
      }

      const profileResult = await getProfile(data.user.id);

      if (isMounted) {
        setProfile(profileResult.profile);
        setIsProfileLoading(false);
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, isLoggedIn, router]);

  useEffect(() => {
    const debounceId = window.setTimeout(() => {
      setFilters((current) => {
        if (current.search === searchInput) {
          return current;
        }

        return { ...current, search: searchInput };
      });
      setPage(1);
    }, 300);

    return () => window.clearTimeout(debounceId);
  }, [searchInput]);

  const loadJobs = useCallback(async () => {
    if (profile?.role_mode !== "job_seeker") {
      return;
    }

    const nextRequestId = requestId.current + 1;
    requestId.current = nextRequestId;
    setIsLoading(true);
    setError(null);

    const nextResult = await loadCandidateSavedJobs(filters, page);

    if (requestId.current !== nextRequestId) {
      return;
    }

    if (page > nextResult.pageCount) {
      setPage(nextResult.pageCount);
      return;
    }

    setResult(nextResult);
    setError(nextResult.error);
    setIsLoading(false);
  }, [filters, page, profile?.role_mode]);

  useEffect(() => {
    if (profile?.role_mode !== "job_seeker") {
      return;
    }

        window.setTimeout(() => {
          void loadJobs();
        }, 0);
  }, [loadJobs, profile?.role_mode]);

  useEffect(() => {
    function reloadSavedJobs() {
      void loadJobs();
    }

    window.addEventListener(savedJobChangedEvent, reloadSavedJobs);

    return () => {
      window.removeEventListener(savedJobChangedEvent, reloadSavedJobs);
    };
  }, [loadJobs]);

  function changeSort(nextSort: SavedJobsToolbarSort) {
    setSort(nextSort);
    setPage(1);

    setFilters((current) => ({
      ...current,
      sort: nextSort === "company" ? "recent" : nextSort,
    }));
  }

  const visibleJobs = useMemo(() => {
    if (sort !== "company") {
      return result.jobs;
    }

    return [...result.jobs].sort((firstJob, secondJob) =>
      firstJob.companyName.localeCompare(secondJob.companyName, undefined, {
        sensitivity: "base",
      }),
    );
  }, [result.jobs, sort]);

  const initialSavedSlugs = useMemo(
    () => result.jobs.flatMap((job) => (job.jobSlug ? [job.jobSlug] : [])),
    [result.jobs],
  );

  if (isAuthLoading || isProfileLoading) {
    return <SavedJobsLoading />;
  }

  if (!isLoggedIn) {
    return <SavedJobsLoading />;
  }

  if (profile?.role_mode !== "job_seeker") {
    return <SavedJobsAccessDenied recruiter={profile?.role_mode === "recruiter"} />;
  }

  const hasFilters = Boolean(filters.search.trim());

  return (
    <main className="saved-jobs-page">
      <SavedJobsDecorations />
      <section className="saved-jobs-content">
        <header className="saved-jobs-hero">
          <div className="saved-jobs-hero-copy">
            <p className="saved-jobs-eyebrow">
              Job Seeker Dashboard
            </p>
            <h1>
              Saved Jobs
            </h1>
            <p>
              Keep interesting opportunities in one place and apply when you are ready.
            </p>
          </div>
          <Link
            className="saved-jobs-browse-button"
            href="/jobs"
          >
            <BriefcaseIcon size={18} />
            Browse Jobs
          </Link>
        </header>

        <section className="saved-jobs-filter-panel" aria-label="Saved Jobs filters">
          <div className="saved-jobs-filter-grid">
            <label className="grid gap-2">
              <span className="saved-jobs-field-label">
                Search
              </span>
              <span className="saved-jobs-search-field">
                <SearchIcon size={17} />
                <input
                  aria-label="Search saved jobs by job title or company"
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by job title or company..."
                  type="search"
                  value={searchInput}
                />
              </span>
            </label>
            <label className="saved-jobs-sort-field">
              <span className="saved-jobs-field-label">
                Sort
              </span>
              <select
                aria-label="Sort saved jobs"
                onChange={(event) =>
                  changeSort(event.target.value as SavedJobsToolbarSort)
                }
                value={sort}
              >
                <option value="recent">Recently Saved</option>
                <option value="newest_job">Recently Posted</option>
                <option value="company">Company A-Z</option>
              </select>
            </label>
          </div>
        </section>

        {error ? (
          <div className="saved-jobs-state-card saved-jobs-error-state">
            <SavedJobsEmptyIllustration />
            <h2 className="text-2xl font-bold text-[#0B1028]">Saved Jobs unavailable</h2>
            <p className="mt-3 text-[15px] leading-6 text-[#65708E]">
              {error}
            </p>
            <button
              className="saved-jobs-dark-button mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-[#DDD6FE]"
              onClick={() => void loadJobs()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        {isLoading && !error ? (
          <div className="mt-8 grid gap-4" aria-live="polite">
            {[0, 1].map((item) => (
              <div
                aria-hidden="true"
                className="h-48 animate-pulse rounded-2xl border border-gray-200 bg-white"
                key={item}
              />
            ))}
          </div>
        ) : null}

        {!isLoading && !error && result.jobs.length === 0 ? (
          <SavedJobsEmpty filtered={hasFilters} />
        ) : null}

        {!error && result.jobs.length > 0 ? (
          <SavedJobsProvider
            initialSavedSlugs={initialSavedSlugs}
            jobSlugs={initialSavedSlugs}
          >
            <div className="mt-8 grid gap-4">
              {visibleJobs.map((job, index) => (
                <SavedJobCard
                  job={job}
                  key={`${job.jobSlug ?? job.jobTitle}-${job.savedAt ?? index}`}
                />
              ))}
            </div>
          </SavedJobsProvider>
        ) : null}

        {!error && !isLoading && result.pageCount > 1 ? (
          <nav
            aria-label="Saved Jobs pagination"
            className="mt-8 flex flex-col items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-[0_14px_35px_rgba(17,24,39,0.06)] sm:flex-row"
          >
            <p className="text-sm font-medium text-gray-500">
              Page {page} of {result.pageCount} / {result.totalCount} saved jobs
            </p>
            <div className="flex gap-3">
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Previous
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page >= result.pageCount || isLoading}
                onClick={() => setPage((current) => Math.min(result.pageCount, current + 1))}
                type="button"
              >
                Next
              </button>
            </div>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
