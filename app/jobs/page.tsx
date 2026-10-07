import JobsPageActions from "./jobs-page-actions";
import JobsList from "./jobs-list";
import RecruiterJobsView from "./recruiter-jobs-view";
import { JobsPageDecorations } from "./jobs-illustrations";
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
    <main className="jobs-reference-page">
      <StructuredData data={createJobsStructuredData()} />
      <JobsPageDecorations />
      <nav className="jobs-reference-actions" aria-label="Jobs page actions">
        <JobsPageActions />
      </nav>
      <section className="jobs-reference-content">
        <div className="jobs-reference-hero">
          <div className="jobs-reference-eyebrow">
            <span className="jobs-reference-eyebrow-mark jobs-reference-eyebrow-mark-left" aria-hidden="true" />
            <p>Public Jobs</p>
            <span className="jobs-reference-eyebrow-mark jobs-reference-eyebrow-mark-right" aria-hidden="true" />
          </div>
          <h1>Browse Jobs</h1>
          <p>
            Explore published roles from companies hiring now.
          </p>
          <svg className="jobs-reference-wave" aria-hidden="true" focusable="false" viewBox="0 0 110 16">
            <path d="M2 8c9-7 15 7 24 0s15 7 24 0 15 7 24 0 15 7 34 0" />
          </svg>
        </div>

        <JobsList filters={filters} result={result} />
      </section>
    </main>
  );
}
