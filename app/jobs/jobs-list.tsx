"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { JobsPostJobCta } from "./jobs-page-actions";
import SaveJobButton from "./save-job-button";
import { SavedJobsProvider } from "./saved-jobs-state";
import {
  createJobsHref,
  fetchPublicJobs,
  formatPostedTime,
  formatPublicJobEmploymentType,
  formatPublicJobExperience,
  formatPublicJobSalary,
  formatPublicJobWorkplaceType,
  getPublicJobSortLabel,
  parsePublicJobFilters,
  publicEmploymentTypeOptions,
  publicExperienceLevelOptions,
  publicJobSortOptions,
  publicJobsPerPage,
  publicWorkplaceTypeOptions,
  type PublicJobFilters,
  type PublicJobListItem,
  type PublicJobsResult,
} from "@/lib/public-jobs";

type FilterKey =
  | "category"
  | "employmentType"
  | "experienceLevel"
  | "featured"
  | "location"
  | "query"
  | "sort"
  | "workplaceType";

type ActiveFilter = {
  key: FilterKey;
  label: string;
};

type LoadOptions = {
  force?: boolean;
};

const inputClassName =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100";

const selectClassName =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100";

function getFilterSignature(filters: PublicJobFilters) {
  return [
    filters.category,
    filters.employmentType,
    filters.experienceLevel,
    filters.featured ? "true" : "false",
    filters.location,
    filters.page,
    filters.query,
    filters.sort,
    filters.workplaceType,
  ].join("|");
}

function getEmptyFilters(initialFilters: PublicJobFilters): PublicJobFilters {
  return {
    ...initialFilters,
    category: "",
    employmentType: "",
    experienceLevel: "",
    featured: false,
    location: "",
    page: 1,
    query: "",
    sort: "newest",
    workplaceType: "",
  };
}

function getFiltersFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  return parsePublicJobFilters(
    Object.fromEntries(new URLSearchParams(window.location.search)),
  );
}

function updateJobsUrl(filters: PublicJobFilters) {
  if (typeof window === "undefined") {
    return;
  }

  window.history.replaceState(
    window.history.state,
    "",
    createJobsHref(filters, {}),
  );
}

function getActiveFilters(filters: PublicJobFilters): ActiveFilter[] {
  const active: ActiveFilter[] = [];

  if (filters.query) {
    active.push({ key: "query", label: `Search: ${filters.query}` });
  }

  if (filters.location) {
    active.push({ key: "location", label: filters.location });
  }

  if (filters.category) {
    active.push({ key: "category", label: filters.category });
  }

  if (filters.employmentType) {
    active.push({
      key: "employmentType",
      label: formatPublicJobEmploymentType(filters.employmentType),
    });
  }

  if (filters.workplaceType) {
    active.push({
      key: "workplaceType",
      label: formatPublicJobWorkplaceType(filters.workplaceType),
    });
  }

  if (filters.experienceLevel) {
    active.push({
      key: "experienceLevel",
      label: formatPublicJobExperience(filters.experienceLevel),
    });
  }

  if (filters.sort !== "newest") {
    active.push({ key: "sort", label: getPublicJobSortLabel(filters.sort) });
  }

  if (filters.featured) {
    active.push({ key: "featured", label: "Featured" });
  }

  return active;
}

function getAdvancedFilterCount(filters: PublicJobFilters) {
  return [
    filters.employmentType,
    filters.workplaceType,
    filters.experienceLevel,
    filters.sort !== "newest" ? filters.sort : "",
    filters.featured ? "featured" : "",
  ].filter(Boolean).length;
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label
      className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}

export function JobCard({
  job,
  showApply = false,
}: {
  job: PublicJobListItem;
  showApply?: boolean;
}) {
  const companyInitial = job.companyName.trim().charAt(0).toUpperCase() || "J";

  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-[0_18px_50px_rgba(17,24,39,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(17,24,39,0.12)] sm:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-[0_10px_24px_rgba(17,24,39,0.18)]">
              {companyInitial}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {job.featured ? (
                  <span className="rounded-full bg-yellow-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent-foreground ring-1 ring-yellow-200">
                    Featured
                  </span>
                ) : null}
                <span className="text-xs font-semibold text-muted-foreground">
                  {formatPostedTime(job.postedAt)}
                </span>
              </div>
              <h2 className="mt-3 break-words text-xl font-bold tracking-tight text-card-foreground">
                <Link
                  href={`/jobs/${job.slug}`}
                  className="transition-colors duration-200 hover:text-yellow-700 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                >
                  {job.title}
                </Link>
              </h2>
              <p className="mt-2 break-words text-sm font-semibold text-muted-foreground">
                {job.companyName}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3 sm:flex-col sm:items-stretch">
            <SaveJobButton compact jobSlug={job.slug} jobTitle={job.title} />
            <div className="rounded-xl border border-border bg-muted px-4 py-3 text-left sm:min-w-48">
              <p className="text-sm font-bold tracking-tight text-card-foreground">
                {formatPublicJobSalary(job.salary)}
              </p>
              {job.applicationsCount > 0 ? (
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {job.applicationsCount} applications
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-5">
          {[
            job.location,
            formatPublicJobEmploymentType(job.employmentType),
            formatPublicJobWorkplaceType(job.workplaceType),
            formatPublicJobExperience(job.experienceLevel),
            job.category,
          ].map((detail) => (
            <span
              key={detail}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground"
            >
              {detail}
            </span>
          ))}
        </div>

        {showApply ? (
          <div className="flex justify-end border-t border-gray-100 pt-5">
            <Link
              href={`/jobs/${job.slug}`}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
            >
              Apply Now
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Pagination({
  isLoading,
  onPageChange,
  page,
  pageCount,
  totalCount,
}: {
  isLoading: boolean;
  onPageChange: (page: number) => void;
  page: number;
  pageCount: number;
  totalCount: number;
}) {
  if (pageCount <= 1 && totalCount <= publicJobsPerPage) {
    return null;
  }

  return (
    <nav
      aria-label="Jobs pagination"
      className="mt-8 flex flex-col items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-[0_14px_35px_rgba(17,24,39,0.06)] sm:flex-row"
    >
      <p className="text-sm font-medium text-gray-500">
        Page {page} of {pageCount} / {totalCount} jobs
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={isLoading || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={isLoading || page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

export default function JobsList({
  filters: initialFilters,
  result: initialResult,
}: {
  filters: PublicJobFilters;
  result: PublicJobsResult;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [result, setResult] = useState(initialResult);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const filtersRef = useRef(filters);
  const debounceTimerRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const lastFetchedSignatureRef = useRef(getFilterSignature(initialFilters));

  const loadResults = useCallback(
    async (nextFilters: PublicJobFilters, options: LoadOptions = {}) => {
      const signature = getFilterSignature(nextFilters);

      if (!options.force && lastFetchedSignatureRef.current === signature) {
        return;
      }

      lastFetchedSignatureRef.current = signature;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsLoading(true);

      try {
        const nextResult = await fetchPublicJobs(nextFilters);

        if (requestId !== requestIdRef.current) {
          return;
        }

        setResult(nextResult);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadResults(filtersRef.current);
    }, 420);

    debounceTimerRef.current = timer;

    return () => {
      window.clearTimeout(timer);
      if (debounceTimerRef.current === timer) {
        debounceTimerRef.current = null;
      }
    };
  }, [filters.category, filters.location, filters.query, loadResults]);

  useEffect(() => {
    function handlePopState() {
      const nextFilters = getFiltersFromUrl();

      if (!nextFilters) {
        return;
      }

      filtersRef.current = nextFilters;
      setFilters(nextFilters);
      void loadResults(nextFilters);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [loadResults]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const activeFilters = useMemo(() => getActiveFilters(filters), [filters]);
  const activeAdvancedCount = useMemo(
    () => getAdvancedFilterCount(filters),
    [filters],
  );
  const filtersAreActive = activeFilters.length > 0;

  function applyFilterChange(
    changes: Partial<PublicJobFilters>,
    options: { immediate?: boolean } = {},
  ) {
    const nextFilters = {
      ...filtersRef.current,
      ...changes,
      page: 1,
    };

    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    updateJobsUrl(nextFilters);

    if (options.immediate) {
      void loadResults(nextFilters);
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    void loadResults(filtersRef.current);
  }

  function handleClearFilters() {
    const nextFilters = getEmptyFilters(initialFilters);

    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    updateJobsUrl(nextFilters);
    void loadResults(nextFilters);
  }

  function handleRemoveFilter(key: FilterKey) {
    const emptyValue =
      key === "featured"
        ? false
        : key === "sort"
          ? "newest"
          : "";

    applyFilterChange({ [key]: emptyValue } as Partial<PublicJobFilters>, {
      immediate: true,
    });
  }

  function handlePageChange(page: number) {
    const nextFilters = { ...filtersRef.current, page };

    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    updateJobsUrl(nextFilters);
    void loadResults(nextFilters);
  }

  return (
    <>
      <div className="mt-10 flex w-full max-w-5xl flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Published jobs</h2>
          <p className="mt-1 text-sm text-gray-500">
            Search and filter roles that are live for candidates.
          </p>
        </div>
        <span
          aria-live="polite"
          className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-gray-900"
        >
          {isLoading ? "Updating" : `${result.totalCount} live`}
        </span>
      </div>

      <form
        onSubmit={handleSearchSubmit}
        className="mt-8 w-full max-w-5xl rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(17,24,39,0.08)] sm:p-6"
      >
        <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr_1fr]">
          <div className="grid gap-2">
            <FieldLabel htmlFor="public-job-search">Search</FieldLabel>
            <input
              id="public-job-search"
              value={filters.query}
              maxLength={80}
              onChange={(event) =>
                applyFilterChange({ query: event.target.value })
              }
              className={inputClassName}
              placeholder="Search by title, company, skill or keyword"
              type="search"
            />
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="public-job-location">Location</FieldLabel>
            <input
              id="public-job-location"
              value={filters.location}
              maxLength={80}
              onChange={(event) =>
                applyFilterChange({ location: event.target.value })
              }
              className={inputClassName}
              placeholder="City, state or remote"
              type="search"
            />
          </div>

          <div className="grid gap-2">
            <FieldLabel htmlFor="public-job-category">Category</FieldLabel>
            <input
              id="public-job-category"
              value={filters.category}
              maxLength={80}
              onChange={(event) =>
                applyFilterChange({ category: event.target.value })
              }
              className={inputClassName}
              placeholder="All categories"
              type="search"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            aria-controls="public-job-advanced-filters"
            aria-expanded={isAdvancedOpen}
            onClick={() => setIsAdvancedOpen((open) => !open)}
            className="inline-flex h-10 w-fit items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-colors duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            More filters{activeAdvancedCount > 0 ? ` (${activeAdvancedCount})` : ""}
            <span aria-hidden="true" className="ml-2 text-gray-400">
              {isAdvancedOpen ? "-" : "+"}
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-3">
            {filtersAreActive ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-sm font-semibold text-gray-500 underline decoration-yellow-400 underline-offset-4 transition-colors hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200"
              >
                Clear filters
              </button>
            ) : null}
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
            >
              Search Jobs
            </button>
          </div>
        </div>

        {isAdvancedOpen ? (
          <div
            id="public-job-advanced-filters"
            className="mt-5 grid gap-4 border-t border-gray-100 pt-5 md:grid-cols-2 lg:grid-cols-5"
          >
            <div className="grid gap-2">
              <FieldLabel htmlFor="public-job-employment">Employment type</FieldLabel>
              <select
                id="public-job-employment"
                value={filters.employmentType}
                onChange={(event) =>
                  applyFilterChange(
                    { employmentType: event.target.value as PublicJobFilters["employmentType"] },
                    { immediate: true },
                  )
                }
                className={selectClassName}
              >
                <option value="">All employment types</option>
                {publicEmploymentTypeOptions.map((employmentType) => (
                  <option key={employmentType} value={employmentType}>
                    {formatPublicJobEmploymentType(employmentType)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <FieldLabel htmlFor="public-job-workplace">Workplace</FieldLabel>
              <select
                id="public-job-workplace"
                value={filters.workplaceType}
                onChange={(event) =>
                  applyFilterChange(
                    { workplaceType: event.target.value as PublicJobFilters["workplaceType"] },
                    { immediate: true },
                  )
                }
                className={selectClassName}
              >
                <option value="">All workplaces</option>
                {publicWorkplaceTypeOptions.map((workplaceType) => (
                  <option key={workplaceType} value={workplaceType}>
                    {formatPublicJobWorkplaceType(workplaceType)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <FieldLabel htmlFor="public-job-experience">Experience level</FieldLabel>
              <select
                id="public-job-experience"
                value={filters.experienceLevel}
                onChange={(event) =>
                  applyFilterChange(
                    { experienceLevel: event.target.value as PublicJobFilters["experienceLevel"] },
                    { immediate: true },
                  )
                }
                className={selectClassName}
              >
                <option value="">All experience levels</option>
                {publicExperienceLevelOptions.map((experienceLevel) => (
                  <option key={experienceLevel} value={experienceLevel}>
                    {formatPublicJobExperience(experienceLevel)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <FieldLabel htmlFor="public-job-sort">Sort</FieldLabel>
              <select
                id="public-job-sort"
                value={filters.sort}
                onChange={(event) =>
                  applyFilterChange(
                    { sort: event.target.value as PublicJobFilters["sort"] },
                    { immediate: true },
                  )
                }
                className={selectClassName}
              >
                {publicJobSortOptions.map((sort) => (
                  <option key={sort} value={sort}>
                    {getPublicJobSortLabel(sort)}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-900">
              <input
                checked={filters.featured}
                onChange={(event) =>
                  applyFilterChange(
                    { featured: event.target.checked },
                    { immediate: true },
                  )
                }
                className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-300"
                type="checkbox"
              />
              <span>Featured only</span>
            </label>
          </div>
        ) : null}

        {activeFilters.length > 0 ? (
          <div
            aria-label="Active filters"
            className="mt-5 flex flex-wrap gap-2"
          >
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                aria-label={`Remove ${filter.label} filter`}
                onClick={() => handleRemoveFilter(filter.key)}
                className="inline-flex min-h-8 items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-gray-900 transition-colors duration-200 hover:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-200"
              >
                <span>{filter.label}</span>
                <span aria-hidden="true" className="text-gray-500">
                  x
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </form>

      <div
        aria-busy={isLoading}
        className="relative mt-8 w-full max-w-5xl"
      >
        <div
          aria-live="polite"
          className="mb-3 min-h-5 text-sm font-medium text-gray-500"
        >
          {isLoading ? "Updating results..." : `${result.totalCount} jobs found`}
        </div>

        {result.error ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
            <h2 className="text-lg font-bold text-gray-900">Jobs are unavailable</h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">{result.error}</p>
            <button
              type="button"
              onClick={() => void loadResults(filtersRef.current, { force: true })}
              className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200"
            >
              Try again
            </button>
          </div>
        ) : null}

        {!result.error && result.jobs.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
            <h2 className="text-lg font-bold text-gray-900">
              {filtersAreActive
                ? "No jobs match your current filters."
                : "No jobs are available right now."}
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              {filtersAreActive
                ? "Clear a filter or try a broader search."
                : "Check back soon for new published roles."}
            </p>
            {filtersAreActive ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-5 inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}

        {!result.error && result.jobs.length > 0 ? (
          <div className={`flex flex-col gap-4 transition-opacity duration-200 ${isLoading ? "opacity-65" : "opacity-100"}`}>
            <SavedJobsProvider jobSlugs={result.jobs.map((job) => job.slug)}>
              {result.jobs.map((job) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </SavedJobsProvider>
          </div>
        ) : null}
      </div>

      {!result.error ? (
        <div className="w-full max-w-5xl">
          <Pagination
            isLoading={isLoading}
            onPageChange={handlePageChange}
            page={result.page}
            pageCount={result.pageCount}
            totalCount={result.totalCount}
          />
        </div>
      ) : null}

      <JobsPostJobCta />
    </>
  );
}
