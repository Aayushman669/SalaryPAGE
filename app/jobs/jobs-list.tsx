import Link from "next/link";
import type { ReactNode } from "react";
import { JobsPostJobCta } from "./jobs-page-actions";
import JobsResetButton from "./jobs-reset-button";
import JobsSearchButton from "./jobs-search-button";
import SaveJobButton from "./save-job-button";
import { SavedJobsProvider } from "./saved-jobs-state";
import {
  createJobsHref,
  formatPostedTime,
  formatPublicJobEmploymentType,
  formatPublicJobExperience,
  formatPublicJobSalary,
  formatPublicJobWorkplaceType,
  getPublicJobSortLabel,
  publicEmploymentTypeOptions,
  publicExperienceLevelOptions,
  publicJobSortOptions,
  publicJobsPerPage,
  publicWorkplaceTypeOptions,
  type PublicJobFilters,
  type PublicJobListItem,
  type PublicJobsResult,
} from "@/lib/public-jobs";

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
            <SaveJobButton
              compact
              jobSlug={job.slug}
              jobTitle={job.title}
            />
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

function SelectField({
  children,
  defaultValue,
  label,
  name,
}: {
  children: ReactNode;
  defaultValue: string;
  label: string;
  name: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
      >
        {children}
      </select>
    </label>
  );
}

function Pagination({
  filters,
  page,
  pageCount,
  totalCount,
}: {
  filters: PublicJobFilters;
  page: number;
  pageCount: number;
  totalCount: number;
}) {
  if (pageCount <= 1 && totalCount <= publicJobsPerPage) {
    return null;
  }

  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(pageCount, page + 1);

  return (
    <nav
      aria-label="Jobs pagination"
      className="mt-8 flex flex-col items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-[0_14px_35px_rgba(17,24,39,0.06)] sm:flex-row"
    >
      <p className="text-sm font-medium text-gray-500">
        Page {page} of {pageCount} / {totalCount} jobs
      </p>
      <div className="flex gap-3">
        {page > 1 ? (
          <Link
            href={createJobsHref(filters, { page: previousPage })}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            Previous
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 px-4 text-sm font-semibold text-gray-400"
          >
            Previous
          </button>
        )}

        {page < pageCount ? (
          <Link
            href={createJobsHref(filters, { page: nextPage })}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            Next
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 px-4 text-sm font-semibold text-gray-400"
          >
            Next
          </button>
        )}
      </div>
    </nav>
  );
}

export default function JobsList({
  filters,
  result,
}: {
  filters: PublicJobFilters;
  result: PublicJobsResult;
}) {
  return (
    <>
      <form
        action="/jobs"
        className="mt-10 w-full max-w-5xl rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(17,24,39,0.08)] sm:p-6"
      >
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr_0.8fr]">
          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              Search
            </span>
            <input
              name="q"
              defaultValue={filters.query}
              maxLength={80}
              className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              placeholder="Title, company, location, category"
              type="search"
            />
          </label>

          <SelectField
            defaultValue={filters.employmentType}
            label="Employment"
            name="employment_type"
          >
            <option value="">All employment</option>
            {publicEmploymentTypeOptions.map((employmentType) => (
              <option key={employmentType} value={employmentType}>
                {formatPublicJobEmploymentType(employmentType)}
              </option>
            ))}
          </SelectField>

          <SelectField
            defaultValue={filters.workplaceType}
            label="Workplace"
            name="workplace_type"
          >
            <option value="">All workplaces</option>
            {publicWorkplaceTypeOptions.map((workplaceType) => (
              <option key={workplaceType} value={workplaceType}>
                {formatPublicJobWorkplaceType(workplaceType)}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <SelectField
            defaultValue={filters.experienceLevel}
            label="Experience"
            name="experience_level"
          >
            <option value="">All levels</option>
            {publicExperienceLevelOptions.map((experienceLevel) => (
              <option key={experienceLevel} value={experienceLevel}>
                {formatPublicJobExperience(experienceLevel)}
              </option>
            ))}
          </SelectField>

          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              Category
            </span>
            <input
              name="category"
              defaultValue={filters.category}
              maxLength={80}
              className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              placeholder="Engineering"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              Location
            </span>
            <input
              name="location"
              defaultValue={filters.location}
              maxLength={80}
              className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              placeholder="Remote, Delhi, NYC"
            />
          </label>

          <SelectField defaultValue={filters.sort} label="Sort" name="sort">
            {publicJobSortOptions.map((sort) => (
              <option key={sort} value={sort}>
                {getPublicJobSortLabel(sort)}
              </option>
            ))}
          </SelectField>

          <label className="flex min-h-[4.25rem] items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 pb-3">
            <input
              name="featured"
              value="true"
              defaultChecked={filters.featured}
              className="mb-1 h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-300"
              type="checkbox"
            />
            <span className="text-sm font-semibold text-gray-900">
              Featured only
            </span>
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-gray-500">
            Showing published jobs only.
          </p>
          <div className="flex gap-3">
            <JobsResetButton />
            <JobsSearchButton />
          </div>
        </div>
      </form>

      {result.error ? (
        <div className="mt-10 w-full max-w-5xl rounded-xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
          <h2 className="text-lg font-bold text-gray-900">
            Jobs are unavailable
          </h2>
          <p className="mt-3 text-sm leading-6 text-gray-500">
            {result.error}
          </p>
        </div>
      ) : null}

      {!result.error && result.jobs.length === 0 ? (
        <div className="mt-10 w-full max-w-5xl rounded-xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
          <h2 className="text-lg font-bold text-gray-900">
            No jobs available yet.
          </h2>
          <p className="mt-3 text-sm leading-6 text-gray-500">
            Try adjusting filters or check back soon.
          </p>
        </div>
      ) : null}

      {!result.error && result.jobs.length > 0 ? (
        <SavedJobsProvider jobSlugs={result.jobs.map((job) => job.slug)}>
          <div className="mt-8 flex w-full max-w-5xl flex-col gap-4">
            {result.jobs.map((job) => (
              <JobCard key={job.slug} job={job} />
            ))}
          </div>
        </SavedJobsProvider>
      ) : null}

      {!result.error ? (
        <div className="w-full max-w-5xl">
          <Pagination
            filters={filters}
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
