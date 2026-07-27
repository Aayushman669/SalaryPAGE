"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SaveJobButton from "@/app/jobs/save-job-button";
import { savedJobChangedEvent } from "@/app/jobs/saved-jobs-state";
import type { CandidateSavedJobsSummary } from "@/lib/saved-jobs";

export default function CandidateSavedJobsSummary({
  summary,
}: {
  summary: CandidateSavedJobsSummary;
}) {
  const [removedJobSlugs, setRemovedJobSlugs] = useState<string[]>([]);

  useEffect(() => {
    function handleSavedJobChange(event: Event) {
      const detail = (event as CustomEvent<{ jobSlug?: string; saved?: boolean }>).detail;

      if (!detail?.jobSlug || detail.saved !== false) {
        return;
      }

      setRemovedJobSlugs((current) =>
        current.includes(detail.jobSlug as string)
          ? current
          : [...current, detail.jobSlug as string],
      );
    }

    window.addEventListener(savedJobChangedEvent, handleSavedJobChange);
    return () => window.removeEventListener(savedJobChangedEvent, handleSavedJobChange);
  }, []);

  const jobs = useMemo(
    () =>
      summary.recentJobs.filter(
        (job) => !job.jobSlug || !removedJobSlugs.includes(job.jobSlug),
      ),
    [removedJobSlugs, summary.recentJobs],
  );
  const savedCount = Math.max(0, summary.savedCount - removedJobSlugs.length);

  return (
    <section className="mt-12 rounded-2xl border border-border bg-card p-5 shadow-[0_18px_45px_rgba(17,24,39,0.08)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Saved Jobs
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-card-foreground">
            Keep promising roles close
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {savedCount} saved job{savedCount === 1 ? "" : "s"} to revisit.
          </p>
        </div>
        <Link
          className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground transition-all duration-200 hover:border-accent hover:bg-accent/10 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          href="/saved-jobs"
        >
          View All Saved Jobs
        </Link>
      </div>

      {summary.error ? (
        <div className="mt-6 rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
          Saved Jobs are temporarily unavailable. You can still browse jobs and try again later.
        </div>
      ) : null}

      {!summary.error && jobs.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted p-6 text-center">
          <p className="text-sm font-semibold text-card-foreground">No saved jobs.</p>
          <Link
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200"
            href="/jobs"
          >
            Browse Jobs
          </Link>
        </div>
      ) : null}

      {!summary.error && jobs.length > 0 ? (
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {jobs.map((job, index) => (
            <article
              className="min-w-0 rounded-xl border border-border bg-muted p-4"
              key={`${job.jobSlug ?? "unavailable"}-${job.savedAt ?? index}`}
            >
              <p className="truncate text-sm font-bold text-card-foreground" title={job.jobTitle}>
                {job.jobTitle}
              </p>
              <p className="mt-1 truncate text-xs font-medium text-muted-foreground" title={job.companyName}>
                {job.companyName}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {job.location ? <span>{job.location}</span> : null}
                {job.workplaceType ? <span>{job.workplaceType}</span> : null}
              </div>
              {job.availabilityStatus === "available" && job.jobSlug ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200"
                    href={`/jobs/${job.jobSlug}`}
                  >
                    {job.hasApplied ? "Applied" : "Apply"}
                  </Link>
                  <SaveJobButton
                    compact
                    jobSlug={job.jobSlug}
                    jobTitle={job.jobTitle}
                  />
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    This job is no longer available.
                  </span>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
