import {
  cleanSeoText,
  getProductionSiteUrl,
  isPublicJobIndexable,
  siteDescription,
  siteName,
} from "@/lib/seo";
import { safeHttpUrl } from "@/lib/input-safety";
import type { PublicJobDetails } from "@/lib/public-jobs";

export type JsonLdObject = Record<string, unknown>;

type OrganizationOptions = {
  description?: string | null;
  logo?: string | null;
  name: string;
  profilePath?: string;
  sameAs?: readonly (string | null | undefined)[];
};

type WebPageOptions = {
  description: string;
  isPartOf?: string;
  name: string;
  path: string;
};

type PricingPlan = {
  billingLabel: string;
  description: string;
  name: string;
  price: number;
};

function getSchemaUrl(path: string) {
  const productionSiteUrl = getProductionSiteUrl();

  return productionSiteUrl
    ? new URL(path.startsWith("/") ? path : `/${path}`, productionSiteUrl).toString()
    : undefined;
}

function getSchemaId(path: string, fragment: string) {
  const url = getSchemaUrl(path);
  return url ? `${url}#${fragment}` : undefined;
}

function getAbsoluteUrl(value: string | null | undefined) {
  return safeHttpUrl(value) ?? undefined;
}

function cleanDescription(value: string | null | undefined) {
  const description = cleanSeoText(value);
  return description || undefined;
}

function getValidIsoDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return undefined;
  }

  return new Date(value).toISOString();
}

const jobEmploymentTypes: Partial<Record<PublicJobDetails["employmentType"], string>> = {
  contract: "CONTRACTOR",
  freelance: "CONTRACTOR",
  full_time: "FULL_TIME",
  internship: "INTERN",
  part_time: "PART_TIME",
  temporary: "TEMPORARY",
};

const jobExperienceRequirements: Partial<Record<NonNullable<PublicJobDetails["experienceLevel"]>, string>> = {
  entry: "Entry-level experience",
  executive: "Executive-level experience",
  internship: "Internship-level experience",
  lead: "Lead-level experience",
  mid: "Mid-level experience",
  senior: "Senior-level experience",
};

function createJobSalarySchema(job: PublicJobDetails) {
  if (!job.salary.visible) {
    return undefined;
  }

  const min = typeof job.salary.min === "number" && Number.isFinite(job.salary.min)
    ? job.salary.min
    : null;
  const max = typeof job.salary.max === "number" && Number.isFinite(job.salary.max)
    ? job.salary.max
    : null;
  const currency = job.salary.currency.trim().toUpperCase();

  if (
    (min === null && max === null) ||
    !/^[A-Z]{3}$/.test(currency)
  ) {
    return undefined;
  }

  const value = min !== null && max !== null
    ? {
        "@type": "QuantitativeValue",
        maxValue: max,
        minValue: min,
      }
    : {
        "@type": "QuantitativeValue",
        value: min ?? max,
      };

  return {
    "@type": "MonetaryAmount",
    currency,
    value,
  };
}

function createGraph(nodes: JsonLdObject[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@graph": nodes,
  };
}

function createOrganizationNode({
  description,
  logo,
  name,
  profilePath,
  sameAs,
}: OrganizationOptions): JsonLdObject {
  const profileUrl = profilePath ? getSchemaUrl(profilePath) : undefined;
  const publicSocialUrls = sameAs
    ?.map((value) => getAbsoluteUrl(value))
    .filter((value): value is string => Boolean(value));
  const absoluteLogo = getAbsoluteUrl(logo);

  return {
    "@type": "Organization",
    ...(profileUrl ? { "@id": `${profileUrl}#organization`, url: profileUrl } : {}),
    name: name.trim(),
    ...(cleanDescription(description) ? { description: cleanDescription(description) } : {}),
    ...(absoluteLogo ? { logo: absoluteLogo } : {}),
    ...(publicSocialUrls?.length ? { sameAs: publicSocialUrls } : {}),
  };
}

function createWebPageNode({
  description,
  isPartOf,
  name,
  path,
}: WebPageOptions): JsonLdObject {
  const pageUrl = getSchemaUrl(path);

  return {
    "@type": "WebPage",
    ...(pageUrl ? { "@id": `${pageUrl}#webpage`, url: pageUrl } : {}),
    name,
    description,
    ...(isPartOf ? { isPartOf: { "@id": isPartOf } } : {}),
  };
}

export function createHomeStructuredData() {
  const organizationId = getSchemaId("/", "organization");
  const websiteId = getSchemaId("/", "website");

  return createGraph([
    createOrganizationNode({
      description: siteDescription,
      name: siteName,
      profilePath: "/",
    }),
    {
      "@type": "WebSite",
      ...(websiteId ? { "@id": websiteId } : {}),
      name: siteName,
      ...(getSchemaUrl("/") ? { url: getSchemaUrl("/") } : {}),
      description: siteDescription,
      ...(organizationId ? { publisher: { "@id": organizationId } } : {}),
    },
    createWebPageNode({
      description: "Browse high-quality jobs from top companies on JobForge.",
      isPartOf: websiteId,
      name: "JobForge",
      path: "/",
    }),
  ]);
}

export function createJobsStructuredData() {
  return createGraph([
    createWebPageNode({
      description: "Explore published roles from companies hiring now.",
      name: "Browse Jobs",
      path: "/jobs",
    }),
  ]);
}

export function createPricingStructuredData(plans: readonly PricingPlan[]) {
  const pricingUrl = getSchemaUrl("/pricing");
  const organizationId = getSchemaId("/", "organization");
  const websiteId = getSchemaId("/", "website");

  return createGraph([
    createWebPageNode({
      description:
        "Compare one-time JobForge plans for focused hiring and growing teams.",
      isPartOf: websiteId,
      name: "Pricing",
      path: "/pricing",
    }),
    {
      "@type": "Service",
      ...(pricingUrl ? { "@id": `${pricingUrl}#service`, url: pricingUrl } : {}),
      name: "JobForge Hiring Plans",
      description:
        "One-time hiring plans for posting jobs and managing applicants on JobForge.",
      ...(organizationId ? { provider: { "@id": organizationId } } : {}),
      offers: plans.map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        description: `${plan.description} ${plan.billingLabel} access.`,
        price: plan.price,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        ...(pricingUrl ? { url: pricingUrl } : {}),
      })),
    },
  ]);
}

export function createCompanyStructuredData({
  about,
  githubUrl,
  facebookUrl,
  instagramUrl,
  linkedinUrl,
  logoUrl,
  name,
  slug,
  twitterUrl,
  youtubeUrl,
}: {
  about: string | null;
  githubUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  logoUrl: string | null;
  name: string;
  slug: string;
  twitterUrl: string | null;
  youtubeUrl: string | null;
}) {
  const websiteId = getSchemaId("/", "website");
  const companyPath = `/company/${encodeURIComponent(slug)}`;

  return createGraph([
    createOrganizationNode({
      description: cleanDescription(about),
      logo: logoUrl,
      name,
      profilePath: companyPath,
      sameAs: [
        linkedinUrl,
        githubUrl,
        twitterUrl,
        facebookUrl,
        instagramUrl,
        youtubeUrl,
      ],
    }),
    createWebPageNode({
      description:
        cleanDescription(about) ||
        `Explore ${name} and its open roles on JobForge.`,
      isPartOf: websiteId,
      name: `${name} | Company Profile`,
      path: companyPath,
    }),
  ]);
}

export function createJobPostingStructuredData(
  job: PublicJobDetails & {
    companyLogoUrl?: string | null;
    companyWebsite?: string | null;
  },
) {
  if (!isPublicJobIndexable(job)) {
    return null;
  }

  const jobUrl = getSchemaUrl(`/jobs/${encodeURIComponent(job.slug)}`);
  const description = [job.description, job.requirements, job.benefits]
    .map((value) => cleanSeoText(value))
    .filter(Boolean)
    .join("\n\n");
  const title = cleanSeoText(job.title);
  const companyName = cleanSeoText(job.companyName);
  const location = cleanSeoText(job.location);
  const category = cleanSeoText(job.category);
  const datePosted = getValidIsoDate(job.publishedAt);
  const validThrough = getValidIsoDate(job.expiresAt);
  const baseSalary = createJobSalarySchema(job);

  if (!description || !title || !companyName || !datePosted) {
    return null;
  }

  const hiringOrganization: JsonLdObject = {
    "@type": "Organization",
    name: companyName,
  };
  const companyLogo = getAbsoluteUrl(job.companyLogoUrl);
  const companyWebsite = getAbsoluteUrl(job.companyWebsite);

  if (companyLogo) {
    hiringOrganization.logo = companyLogo;
  }

  if (companyWebsite) {
    hiringOrganization.url = companyWebsite;
  }

  const jobPosting: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    ...(jobUrl
      ? {
          "@id": `${jobUrl}#jobposting`,
          mainEntityOfPage: { "@id": jobUrl },
          url: jobUrl,
        }
      : {}),
    title,
    description,
    hiringOrganization,
    identifier: {
      "@type": "PropertyValue",
      name: siteName,
      value: job.slug,
    },
    ...(jobEmploymentTypes[job.employmentType]
      ? { employmentType: jobEmploymentTypes[job.employmentType] }
      : {}),
    ...(job.workplaceType === "remote"
      ? { jobLocationType: "TELECOMMUTE" }
      : {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: location,
            },
          },
        }),
    ...(datePosted ? { datePosted } : {}),
    ...(validThrough ? { validThrough } : {}),
    ...(baseSalary ? { baseSalary } : {}),
    ...(category && category !== "General" ? { industry: category } : {}),
    ...(cleanSeoText(job.requirements)
      ? { qualifications: cleanSeoText(job.requirements) }
      : {}),
    ...(job.experienceLevel && jobExperienceRequirements[job.experienceLevel]
      ? { experienceRequirements: jobExperienceRequirements[job.experienceLevel] }
      : {}),
    ...(cleanSeoText(job.benefits)
      ? { benefits: cleanSeoText(job.benefits) }
      : {}),
    directApply: true,
  };

  return jobPosting;
}
