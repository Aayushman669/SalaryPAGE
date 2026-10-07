import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import StructuredData from "@/app/structured-data";
import {
  formatPostedTime,
  formatPublicJobEmploymentType,
  formatPublicJobExperience,
  formatPublicJobSalary,
  formatPublicJobWorkplaceType,
} from "@/lib/public-jobs";
import { fetchCachedPublicJobBySlug } from "@/lib/public-data-cache";
import {
  cleanSeoText,
  createPublicMetadata,
  isPublicJobIndexable,
} from "@/lib/seo";
import { createJobPostingStructuredData } from "@/lib/structured-data";
import JobApplicationPanel from "./job-application-panel";
import JobViewTracker from "./job-view-tracker";
import SaveJobButton from "../save-job-button";
import { SavedJobsProvider } from "../saved-jobs-state";

export const dynamic = "force-dynamic";

type JobDetailsPageProps = {
  params: Promise<{ slug: string }>;
};

function shortenDescription(value: string, fallback: string) {
  const description = cleanSeoText(value);
  return description ? description.slice(0, 160) : fallback;
}

export async function generateMetadata({
  params,
}: JobDetailsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchCachedPublicJobBySlug(slug);

  if (!result.job) {
    return createPublicMetadata({
      description: "This job listing is no longer available.",
      noIndex: true,
      path: `/jobs/${encodeURIComponent(slug)}`,
      title: "Job Not Found",
      type: "article",
    });
  }

  const { job } = result;
  const title = `${job.title} | ${job.companyName}`;
  const description = shortenDescription(
    job.description,
    `${job.title} at ${job.companyName}. Explore the role, requirements, and application details.`,
  );

  return createPublicMetadata({
    title,
    description,
    noIndex: !isPublicJobIndexable(job),
    path: `/jobs/${job.slug}`,
    type: "article",
  });
}

function DetailPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500">
      {children}
    </span>
  );
}

function ContentSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  if (!children) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_16px_45px_rgba(17,24,39,0.05)] sm:p-6">
      <h2 className="text-lg font-bold tracking-tight text-gray-900">
        {title}
      </h2>
      <div className="mt-4 text-sm leading-7 text-gray-600">{children}</div>
    </section>
  );
}

function RichText({ value }: { value: string }) {
  if (!value.trim()) {
    return null;
  }

  return <p className="whitespace-pre-line">{value}</p>;
}

export default async function JobDetailsPage({ params }: JobDetailsPageProps) {
  const { slug } = await params;
  const result = await fetchCachedPublicJobBySlug(slug);

  if (!result.job) {
    notFound();
  }

  const job = result.job;
  const structuredData = createJobPostingStructuredData(job);

  return (
    <main className="ui-consistency-surface min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      {structuredData ? <StructuredData data={structuredData} /> : null}
      <JobViewTracker slug={job.slug} />
      <article className="mx-auto w-full max-w-6xl">
        <div className="mb-8">
          <Link
            href="/jobs"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            Back to Jobs
          </Link>
        </div>

        <header className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_24px_80px_rgba(17,24,39,0.08)]">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-8 sm:px-8 sm:py-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {job.featured ? (
                  <span className="rounded-full bg-yellow-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-900 ring-1 ring-yellow-200">
                    Featured
                  </span>
                ) : null}
                <span className="text-xs font-semibold text-gray-400">
                  {formatPostedTime(job.postedAt)}
                </span>
              </div>
              <SavedJobsProvider jobSlugs={[job.slug]}>
                <SaveJobButton
                  compact
                  jobSlug={job.slug}
                  jobTitle={job.title}
                />
              </SavedJobsProvider>
            </div>
            <h1 className="mt-5 break-words text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {job.title}
            </h1>
            <p className="mt-4 break-words text-xl font-semibold text-gray-700">
              {job.companyName}
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              <DetailPill>{job.location}</DetailPill>
              <DetailPill>
                {formatPublicJobEmploymentType(job.employmentType)}
              </DetailPill>
              <DetailPill>
                {formatPublicJobWorkplaceType(job.workplaceType)}
              </DetailPill>
              <DetailPill>
                {formatPublicJobExperience(job.experienceLevel)}
              </DetailPill>
              <DetailPill>{job.category}</DetailPill>
              <DetailPill>{formatPublicJobSalary(job.salary)}</DetailPill>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="grid gap-5">
            <ContentSection title="Description">
              <RichText value={job.description} />
            </ContentSection>

            {job.requirements ? (
              <ContentSection title="Requirements">
                <RichText value={job.requirements} />
              </ContentSection>
            ) : null}

            {job.benefits ? (
              <ContentSection title="Benefits">
                <RichText value={job.benefits} />
              </ContentSection>
            ) : null}
          </div>

          <JobApplicationPanel
            applicationsCount={job.applicationsCount}
            companyName={job.companyName}
            slug={job.slug}
            title={job.title}
          />
        </div>
      </article>
    </main>
  );
}
