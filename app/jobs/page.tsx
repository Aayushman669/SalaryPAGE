import JobsPageActions from "./jobs-page-actions";
import JobsList from "./jobs-list";
import RecruiterJobsView from "./recruiter-jobs-view";
import StructuredData from "@/app/structured-data";
import { parsePublicJobFilters } from "@/lib/public-jobs";
import { fetchCachedPublicJobs } from "@/lib/public-data-cache";
import { createJobsStructuredData } from "@/lib/structured-data";
import { isRecruiterJobFilter } from "@/lib/recruiter-job-filters";

export const dynamic = "force-dynamic";

type JobsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const resolvedSearchParams = await searchParams;

  const requestedStatus = Array.isArray(resolvedSearchParams.status)
    ? resolvedSearchParams.status[0]
    : resolvedSearchParams.status;

  if (isRecruiterJobFilter(requestedStatus)) {
    return <RecruiterJobsView />;
  }

  const filters = parsePublicJobFilters(resolvedSearchParams);
  const result = await fetchCachedPublicJobs(filters);

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <StructuredData data={createJobsStructuredData()} />
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center">
        <nav className="mb-4 flex w-full items-center justify-end gap-3 empty:hidden sm:mb-12">
          <JobsPageActions />
        </nav>

        <div className="max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
            Public Jobs
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Browse Jobs
          </h1>
          <p className="mt-4 text-lg leading-8 text-gray-500">
            Explore published roles from companies hiring now.
          </p>
        </div>

        <div className="mt-10 flex w-full max-w-5xl flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Published jobs
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Search and filter roles that are live for candidates.
            </p>
          </div>
          <span className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-gray-900">
            {result.totalCount} live
          </span>
        </div>

        <JobsList filters={filters} result={result} />
      </section>
    </main>
  );
}
