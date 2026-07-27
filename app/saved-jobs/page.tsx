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
import {
  savedJobChangedEvent,
  SavedJobsProvider,
} from "@/app/jobs/saved-jobs-state";
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
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <section className="mx-auto w-full max-w-6xl">
        <div className="h-5 w-32 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-5 h-12 w-80 max-w-full animate-pulse rounded-xl bg-gray-100" />
        <div className="mt-10 grid gap-4">
          {[0, 1, 2].map((item) => (
            <div
              aria-hidden="true"
              className="h-48 animate-pulse rounded-2xl border border-gray-200 bg-white"
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
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
          Saved Jobs
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
          {recruiter ? "Saved Jobs are for Job Seekers" : "Saved Jobs unavailable"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          {recruiter
            ? "Switch to a Job Seeker account to save and track roles."
            : "Complete onboarding before viewing saved jobs."}
        </p>
        <Link
          className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200"
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
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
      <h2 className="text-lg font-bold text-gray-900">
        {filtered ? "No matching saved jobs" : "You haven't saved any jobs yet."}
      </h2>
      <p className="mt-3 text-sm leading-6 text-gray-500">
        {filtered
          ? "Try adjusting your search."
          : "Save interesting roles while you browse and return when you are ready."}
      </p>
      <Link
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200"
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
      className={`rounded-2xl border p-5 shadow-[0_18px_50px_rgba(17,24,39,0.08)] sm:p-6 ${
        available ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-base font-bold text-white">
              {job.companyName.trim().charAt(0).toUpperCase() || "J"}
            </div>
            <div className="min-w-0">
              {available && job.featured ? (
                <span className="rounded-full bg-yellow-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-900 ring-1 ring-yellow-200">
                  Featured
                </span>
              ) : null}
              <h2 className="mt-3 break-words text-xl font-bold tracking-tight text-gray-900">
                {available && job.jobSlug ? (
                  <Link
                    className="transition-colors duration-200 hover:text-yellow-700 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                    href={`/jobs/${job.jobSlug}`}
                  >
                    {job.jobTitle}
                  </Link>
                ) : (
                  job.jobTitle
                )}
              </h2>
              <p className="mt-2 break-words text-sm font-semibold text-gray-600">
                {job.companyName}
              </p>
              <p className="mt-1 text-xs font-medium text-gray-400">
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
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left sm:min-w-48">
              <p className="text-sm font-bold tracking-tight text-gray-900">
                {available ? formatSalary(job.salary) : "Unavailable"}
              </p>
              {available && job.hasApplied ? (
                <p className="mt-1 text-xs font-semibold text-yellow-700">
                  Already applied
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {available ? (
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-5">
            {[
              job.location,
              job.employmentType,
              job.workplaceType,
              job.experienceLevel,
            ]
              .filter(Boolean)
              .map((detail) => (
                <span
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500"
                  key={detail}
                >
                  {detail}
                </span>
              ))}
          </div>
        ) : (
          <p className="border-t border-gray-200 pt-5 text-sm font-medium text-gray-500">
            This job is no longer available. You can remove it from Saved Jobs.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-5">
          {available && job.jobSlug ? (
            <Link
              className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
              href={`/jobs/${job.jobSlug}`}
            >
              View Job
            </Link>
          ) : null}
          {available && job.jobSlug && !job.hasApplied ? (
            <Link
              className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200"
              href={`/jobs/${job.jobSlug}`}
            >
              Apply Now
            </Link>
          ) : null}
          {available && job.hasApplied ? (
            <Link
              className="inline-flex h-10 items-center justify-center rounded-xl border border-yellow-200 bg-yellow-50 px-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200"
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
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <section className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
              Job Seeker Dashboard
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Saved Jobs
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-500">
              Keep interesting opportunities in one place and apply when you are ready.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
            href="/jobs"
          >
            Browse Jobs
          </Link>
        </div>

        <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(17,24,39,0.08)] sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
                Search
              </span>
              <input
                aria-label="Search saved jobs by job title or company"
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by job title or company..."
                type="search"
                value={searchInput}
              />
            </label>
            <label className="grid gap-2 lg:min-w-52">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
                Sort
              </span>
              <select
                aria-label="Sort saved jobs"
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
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
        </div>

        {error ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
            <h2 className="text-lg font-bold text-gray-900">Saved Jobs unavailable</h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              {error}
            </p>
            <button
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200"
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
