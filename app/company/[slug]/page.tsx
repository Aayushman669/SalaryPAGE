import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import StructuredData from "@/app/structured-data";
import { JobCard } from "@/app/jobs/jobs-list";
import type { PublicCompanyPageData } from "@/lib/public-company";
import { fetchCachedPublicCompanyPage } from "@/lib/public-data-cache";
import {
  createCompanyStructuredData,
} from "@/lib/structured-data";
import { createPublicMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type CompanyPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | string[] | undefined) {
  const page = Number(firstParam(value));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function formatCompanySize(value: string | null) {
  return value ? `${value} employees` : null;
}

function formatWorkModel(value: string | null) {
  if (!value) {
    return null;
  }

  return value === "on_site"
    ? "On-site"
    : `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function formatHiringStatus(value: string | null) {
  if (value === "always_hiring") {
    return "Always hiring";
  }
  if (value === "not_hiring") {
    return "Not currently hiring";
  }
  return value ? "Currently hiring" : null;
}

function formatMemberSince(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Member since joining"
    : `Member since ${new Intl.DateTimeFormat("en", {
        month: "long",
        year: "numeric",
      }).format(date)}`;
}

function shortenDescription(value: string | null) {
  const description = value?.replace(/\s+/g, " ").trim();
  return description ? description.slice(0, 160) : "Explore this company and its open roles on JobForge.";
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:bg-white/5">
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-gray-900">
        {value}
      </dd>
    </div>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 transition hover:border-yellow-300 hover:bg-yellow-50 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5"
    >
      {label}
    </a>
  );
}

function CompanyPagination({ data }: { data: PublicCompanyPageData }) {
  if (data.jobsPageCount <= 1) {
    return null;
  }

  const previousPage = Math.max(1, data.jobsPage - 1);
  const nextPage = Math.min(data.jobsPageCount, data.jobsPage + 1);

  return (
    <nav
      aria-label="Company jobs pagination"
      className="mt-6 flex flex-col items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 sm:flex-row dark:bg-white/5"
    >
      <p className="text-sm font-medium text-gray-500">
        Page {data.jobsPage} of {data.jobsPageCount}
      </p>
      <div className="flex gap-2">
        {data.jobsPage > 1 ? (
          <Link
            href={`/company/${data.company.slug}?jobs_page=${previousPage}`}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:border-yellow-300 hover:bg-yellow-50 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5"
          >
            Previous
          </Link>
        ) : null}
        {data.jobsPage < data.jobsPageCount ? (
          <Link
            href={`/company/${data.company.slug}?jobs_page=${nextPage}`}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

function UnavailableCompany() {
  return (
    <main className="ui-consistency-surface flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <section className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:bg-white/5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
          Company profile
        </p>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">
          Company profile unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          We could not load this company right now. Please try again soon.
        </p>
        <Link
          href="/jobs"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200"
        >
          Browse Jobs
        </Link>
      </section>
    </main>
  );
}

export async function generateMetadata({
  params,
}: CompanyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchCachedPublicCompanyPage(slug);

  if (!result.data) {
    return createPublicMetadata({
      title: "Company Profile",
      description: "Explore companies and open roles on JobForge.",
      noIndex: true,
      path: `/company/${slug}`,
    });
  }

  const { company } = result.data;
  const description = shortenDescription(company.about);

  return createPublicMetadata({
    title: company.name,
    description,
    image: company.bannerUrl || company.logoUrl,
    imageAlt: `${company.name} company profile`,
    path: `/company/${company.slug}`,
    type: "profile",
  });
}

export default async function PublicCompanyPage({
  params,
  searchParams,
}: CompanyPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const result = await fetchCachedPublicCompanyPage(
    slug,
    parsePage(resolvedSearchParams.jobs_page),
  );

  if (!result.data && !result.error) {
    notFound();
  }

  if (!result.data) {
    return <UnavailableCompany />;
  }

  const { company } = result.data;
  const structuredData = createCompanyStructuredData({
    about: company.about,
    facebookUrl: company.facebookUrl,
    githubUrl: company.githubUrl,
    instagramUrl: company.instagramUrl,
    linkedinUrl: company.linkedinUrl,
    logoUrl: company.logoUrl,
    name: company.name,
    slug: company.slug,
    twitterUrl: company.xUrl,
    youtubeUrl: company.youtubeUrl,
  });

  return (
    <main className="ui-consistency-surface min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <article className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            href="/jobs"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:border-yellow-300 hover:bg-yellow-50 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5"
          >
            Back to Jobs
          </Link>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            Company profile
          </span>
        </div>

        <header className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_24px_80px_rgba(17,24,39,0.08)] dark:bg-white/5">
          <div className="relative h-48 bg-gray-100 sm:h-64 dark:bg-white/10">
            {company.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`${company.name} banner`}
                className="h-full w-full object-cover"
                decoding="async"
                fetchPriority="high"
                loading="eager"
                src={company.bannerUrl}
              />
            ) : (
              <div className="flex h-full items-end bg-gradient-to-br from-yellow-100 via-white to-gray-100 p-6 dark:from-yellow-500/20 dark:via-white/5 dark:to-white/10">
                <span className="text-sm font-semibold text-gray-500">
                  {company.industry || "A company on JobForge"}
                </span>
              </div>
            )}
          </div>
          <div className="relative px-6 pb-7 pt-16 sm:px-8 sm:pb-9">
            <div className="absolute -top-12 left-6 flex h-24 w-24 overflow-hidden rounded-3xl border-4 border-white bg-gray-50 shadow-lg dark:border-[#171719] dark:bg-white/10 sm:left-8">
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`${company.name} logo`}
                  className="h-full w-full object-cover"
                  decoding="async"
                  loading="eager"
                  src={company.logoUrl}
                />
              ) : (
                <span className="m-auto text-3xl font-black text-gray-400">
                  {company.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                    {company.name}
                  </h1>
                  {company.isVerified ? (
                    <span className="rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-900">
                      Verified
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold text-gray-500">
                  {[company.industry, company.headquarters, formatCompanySize(company.companySize), company.foundedYear ? `Founded ${company.foundedYear}` : null]
                    .filter(Boolean)
                    .map((detail) => <span key={detail}>{detail}</span>)}
                </div>
              </div>
              {company.website ? (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-yellow-200"
                >
                  Visit Website
                </a>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:bg-white/5">
              <h2 className="text-xl font-bold tracking-tight text-gray-900">About {company.name}</h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-600">
                {company.about || "This company has not added a public description yet."}
              </p>
              {[company.mission, company.vision, company.culture].some(Boolean) ? (
                <div className="mt-6 grid gap-4 border-t border-gray-200 pt-5 sm:grid-cols-3">
                  {company.mission ? <div><h3 className="text-sm font-bold text-gray-900">Mission</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">{company.mission}</p></div> : null}
                  {company.vision ? <div><h3 className="text-sm font-bold text-gray-900">Vision</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">{company.vision}</p></div> : null}
                  {company.culture ? <div><h3 className="text-sm font-bold text-gray-900">Culture</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">{company.culture}</p></div> : null}
                </div>
              ) : null}
              {company.benefits.length > 0 ? (
                <div className="mt-6 border-t border-gray-200 pt-5">
                  <h3 className="text-sm font-bold text-gray-900">Company benefits</h3>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {company.benefits.map((benefit) => <li key={benefit} className="text-sm text-gray-600">{benefit}</li>)}
                  </ul>
                </div>
              ) : null}
            </section>

            {result.data.gallery.length > 0 ? (
              <section aria-labelledby="company-gallery-title" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:bg-white/5">
                <h2 id="company-gallery-title" className="text-xl font-bold tracking-tight text-gray-900">Life at {company.name}</h2>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {result.data.gallery.map((item) => (
                    <div key={`${item.altText}-${item.imageUrl ?? "missing"}`} className="aspect-[4/3] overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:bg-white/10">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={item.altText} className="h-full w-full object-cover" decoding="async" loading="lazy" src={item.imageUrl} />
                      ) : <span className="flex h-full items-center justify-center px-3 text-center text-xs font-semibold text-gray-500">Image unavailable</span>}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section aria-labelledby="company-jobs-title">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Open roles</p>
                  <h2 id="company-jobs-title" className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Jobs at {company.name}</h2>
                </div>
                <span className="text-sm font-semibold text-gray-500">{result.data.totalActiveJobs} active {result.data.totalActiveJobs === 1 ? "job" : "jobs"}</span>
              </div>
              {result.data.jobs.length > 0 ? (
                <div className="mt-5 grid gap-4">
                  {result.data.jobs.map((job) => <JobCard key={job.slug} job={job} showApply />)}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:bg-white/5">
                  <h3 className="text-lg font-bold text-gray-900">No active jobs available.</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500">Check back later or explore roles from other companies.</p>
                  <Link href="/jobs" className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200">Browse All Jobs</Link>
                </div>
              )}
              <CompanyPagination data={result.data} />
            </section>
          </div>

          <aside className="grid content-start gap-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:bg-white/5">
              <h2 className="text-lg font-bold text-gray-900">Company details</h2>
              <dl className="mt-4 grid gap-3">
                <DetailItem label="Industry" value={company.industry} />
                <DetailItem label="Company size" value={formatCompanySize(company.companySize)} />
                <DetailItem label="Founded" value={company.foundedYear ? String(company.foundedYear) : null} />
                <DetailItem label="Work model" value={formatWorkModel(company.workModel)} />
                <DetailItem label="Headquarters" value={company.headquarters} />
                <DetailItem label="Address" value={company.address} />
                <DetailItem label="Hiring status" value={formatHiringStatus(company.hiringStatus)} />
                <DetailItem label="Website" value={company.website} />
              </dl>
              {[company.linkedinUrl, company.githubUrl, company.xUrl, company.facebookUrl, company.instagramUrl, company.youtubeUrl].some(Boolean) ? (
                <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                  {company.linkedinUrl ? <SocialLink href={company.linkedinUrl} label="LinkedIn" /> : null}
                  {company.githubUrl ? <SocialLink href={company.githubUrl} label="GitHub" /> : null}
                  {company.xUrl ? <SocialLink href={company.xUrl} label="X" /> : null}
                  {company.facebookUrl ? <SocialLink href={company.facebookUrl} label="Facebook" /> : null}
                  {company.instagramUrl ? <SocialLink href={company.instagramUrl} label="Instagram" /> : null}
                  {company.youtubeUrl ? <SocialLink href={company.youtubeUrl} label="YouTube" /> : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:bg-white/5">
              <h2 className="text-lg font-bold text-gray-900">Company at a glance</h2>
              <dl className="mt-4 grid gap-3">
                <DetailItem label="Active jobs" value={String(result.data.totalActiveJobs)} />
                {company.profileCompletion !== null ? <DetailItem label="Profile completion" value={`${company.profileCompletion}%`} /> : null}
                <DetailItem label="Member since" value={formatMemberSince(company.createdAt)} />
              </dl>
            </section>
          </aside>
        </div>

        {result.data.relatedCompanies.length > 0 ? (
          <section className="mt-10 border-t border-gray-200 pt-8" aria-labelledby="related-companies-title">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Explore more</p>
            <h2 id="related-companies-title" className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Related companies</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {result.data.relatedCompanies.map((related) => (
                <Link key={related.slug} href={`/company/${related.slug}`} className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-yellow-300 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-sm font-bold text-white">{related.name.slice(0, 1).toUpperCase()}</span>
                  <h3 className="mt-4 break-words font-bold text-gray-900">{related.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{related.industry || related.companySize || "Company"}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </article>

      <StructuredData data={structuredData} />
    </main>
  );
}
