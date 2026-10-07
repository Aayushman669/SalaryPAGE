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
import {
  ArrowRightIcon,
  BriefcaseIcon,
  CategoryIcon,
  ChevronDownIcon,
  FilterIcon,
  JobsEmptyIllustration,
  LocationIcon,
  SearchIcon,
} from "./jobs-illustrations";
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

const inputClassName = "jobs-filter-input";

const selectClassName = "jobs-filter-select";

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
      className="jobs-field-label"
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
    <article className="jobs-job-card">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="jobs-job-company-mark">
              {companyInitial}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {job.featured ? (
                  <span className="jobs-job-featured">
                    Featured
                  </span>
                ) : null}
                <span className="jobs-job-posted-time">
                  {formatPostedTime(job.postedAt)}
                </span>
              </div>
              <h2 className="jobs-job-title">
                <Link
                  href={`/jobs/${job.slug}`}
                  className="jobs-job-title-link"
                >
                  {job.title}
                </Link>
              </h2>
              <p className="jobs-job-company">
                {job.companyName}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-3 sm:flex-col sm:items-stretch">
            <SaveJobButton compact jobSlug={job.slug} jobTitle={job.title} />
            <div className="jobs-job-salary">
              <p>
                {formatPublicJobSalary(job.salary)}
              </p>
              {job.applicationsCount > 0 ? (
                <p className="jobs-job-applications">
                  {job.applicationsCount} applications
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="jobs-job-details">
          {[
            job.location,
            formatPublicJobEmploymentType(job.employmentType),
            formatPublicJobWorkplaceType(job.workplaceType),
            formatPublicJobExperience(job.experienceLevel),
            job.category,
          ].map((detail) => (
            <span
              key={detail}
              className="jobs-job-detail"
            >
              {detail}
            </span>
          ))}
        </div>

        {showApply ? (
          <div className="jobs-job-apply-row">
            <Link
              href={`/jobs/${job.slug}`}
              className="jobs-primary-action"
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
      className="jobs-pagination"
    >
      <p className="jobs-pagination-label">
        Page {page} of {pageCount} / {totalCount} jobs
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={isLoading || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="jobs-secondary-action"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={isLoading || page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          className="jobs-primary-action"
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
      <div className="jobs-published-strip">
        <div className="jobs-published-copy">
          <div className="jobs-published-icon" aria-hidden="true">
            <BriefcaseIcon size={24} />
          </div>
          <div>
            <h2>Published Jobs</h2>
            <p>
            Search and filter roles that are live for candidates.
            </p>
          </div>
        </div>
        <span
          aria-live="polite"
          className="jobs-live-badge"
        >
          <span className="jobs-live-dot" aria-hidden="true" />
          {isLoading ? "Updating" : `${result.totalCount} LIVE`}
        </span>
      </div>

      <form
        onSubmit={handleSearchSubmit}
        className="jobs-filter-card"
      >
        <div className="jobs-filter-grid">
          <div className="jobs-filter-field">
            <FieldLabel htmlFor="public-job-search">Search</FieldLabel>
            <div className="jobs-filter-control">
              <SearchIcon size={21} />
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
          </div>

          <div className="jobs-filter-field">
            <FieldLabel htmlFor="public-job-location">Location</FieldLabel>
            <div className="jobs-filter-control">
              <LocationIcon size={21} />
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
          </div>

          <div className="jobs-filter-field">
            <FieldLabel htmlFor="public-job-category">Category</FieldLabel>
            <div className="jobs-filter-control">
              <CategoryIcon size={21} />
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
        </div>

        <div className="jobs-filter-actions">
          <button
            type="button"
            aria-controls="public-job-advanced-filters"
            aria-expanded={isAdvancedOpen}
            onClick={() => setIsAdvancedOpen((open) => !open)}
            className="jobs-secondary-action jobs-more-filters"
          >
            <span>More filters{activeAdvancedCount > 0 ? ` (${activeAdvancedCount})` : ""}</span>
            <FilterIcon size={18} />
          </button>

          <div className="jobs-filter-submit-group">
            {filtersAreActive ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="jobs-clear-filters"
              >
                Clear filters
              </button>
            ) : null}
            <button
              type="submit"
              className="jobs-primary-action"
            >
              <span>Search Jobs</span>
              <ArrowRightIcon size={19} />
            </button>
          </div>
        </div>

        {isAdvancedOpen ? (
          <div
            id="public-job-advanced-filters"
            className="jobs-advanced-filters"
          >
            <div className="jobs-filter-field">
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

            <div className="jobs-filter-field">
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

            <div className="jobs-filter-field">
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

            <label className="jobs-featured-toggle">
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
            className="jobs-active-filters"
          >
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                aria-label={`Remove ${filter.label} filter`}
                onClick={() => handleRemoveFilter(filter.key)}
                className="jobs-active-filter"
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

      <div aria-busy={isLoading} className="jobs-results-area">
        <div
          aria-live="polite"
          className="jobs-results-meta"
        >
          <span>
            {isLoading ? "Updating results..." : `${result.totalCount} jobs found`}
          </span>
          <label className="jobs-sort-control" htmlFor="public-job-sort">
            <span>Sort by:</span>
            <select
              id="public-job-sort"
              value={filters.sort}
              onChange={(event) =>
                applyFilterChange(
                  { sort: event.target.value as PublicJobFilters["sort"] },
                  { immediate: true },
                )
              }
              className="jobs-sort-select"
            >
              {publicJobSortOptions.map((sort) => (
                <option key={sort} value={sort}>
                  {getPublicJobSortLabel(sort)}
                </option>
              ))}
            </select>
            <ChevronDownIcon size={17} />
          </label>
        </div>

        {result.error ? (
          <div className="jobs-empty-state jobs-error-state">
            <h2>Jobs are unavailable</h2>
            <p>{result.error}</p>
            <button
              type="button"
              onClick={() => void loadResults(filtersRef.current, { force: true })}
              className="jobs-primary-action"
            >
              Try again
            </button>
          </div>
        ) : null}

        {!result.error && result.jobs.length === 0 ? (
          <div className="jobs-empty-state">
            <JobsEmptyIllustration />
            <div className="jobs-empty-copy">
              <h2>
              {filtersAreActive
                ? "No jobs match your current filters."
                : "No jobs are available right now."}
              </h2>
              <p>
              {filtersAreActive
                ? "Clear a filter or try a broader search."
                : "Check back soon for new published roles."}
              </p>
              {filtersAreActive ? (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="jobs-secondary-action jobs-empty-clear"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {!result.error && result.jobs.length > 0 ? (
          <div className={`jobs-results-list ${isLoading ? "is-loading" : ""}`}>
            <SavedJobsProvider jobSlugs={result.jobs.map((job) => job.slug)}>
              {result.jobs.map((job) => (
                <JobCard key={job.slug} job={job} />
              ))}
            </SavedJobsProvider>
          </div>
        ) : null}
      </div>

      {!result.error ? (
        <div className="jobs-pagination-wrap">
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
