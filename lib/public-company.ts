import "server-only";

import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { clampPositivePage, safeHttpUrl, safePublicSlug } from "@/lib/input-safety";
import {
  mapPublicJobListRow,
  publicJobListColumns,
  type PublicJobListItem,
  type PublicJobListRow,
} from "@/lib/public-jobs";

export const publicCompanyJobsPerPage = 6;

type PublicCompanySourceRow = {
  address: string | null;
  about: string | null;
  banner_path: string | null;
  benefits: string[] | null;
  company_size: string | null;
  culture: string | null;
  created_at: string;
  facebook_url: string | null;
  founded_year: number | null;
  github_url: string | null;
  headquarters: string | null;
  hiring_status: string | null;
  id: string;
  industry: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  logo_path: string | null;
  mission: string | null;
  moderation_status: string | null;
  name: string;
  profile_completion: number | null;
  recruiter_id: string;
  slug: string;
  website: string | null;
  verification_status: string | null;
  vision: string | null;
  work_model: string | null;
  x_url: string | null;
  youtube_url: string | null;
};

type PublicCompanyRelatedSourceRow = Pick<
  PublicCompanySourceRow,
  "about" | "company_size" | "industry" | "name" | "slug" | "moderation_status"
>;

export type PublicCompanyCard = {
  companySize: string | null;
  industry: string | null;
  name: string;
  slug: string;
};

export type PublicCompanyProfile = {
  address: string | null;
  about: string | null;
  benefits: string[];
  companySize: string | null;
  culture: string | null;
  createdAt: string;
  facebookUrl: string | null;
  foundedYear: number | null;
  githubUrl: string | null;
  headquarters: string | null;
  hiringStatus: string | null;
  industry: string | null;
  instagramUrl: string | null;
  isVerified: boolean;
  linkedinUrl: string | null;
  logoUrl: string | null;
  mission: string | null;
  name: string;
  profileCompletion: number | null;
  slug: string;
  website: string | null;
  vision: string | null;
  workModel: string | null;
  xUrl: string | null;
  bannerUrl: string | null;
  youtubeUrl: string | null;
};

export type PublicCompanyGalleryItem = {
  altText: string;
  imageUrl: string | null;
};

export type PublicCompanyPageData = {
  company: PublicCompanyProfile;
  error: string | null;
  gallery: PublicCompanyGalleryItem[];
  jobs: PublicJobListItem[];
  jobsPage: number;
  jobsPageCount: number;
  relatedCompanies: PublicCompanyCard[];
  totalActiveJobs: number;
};

export type PublicCompanyPageResult = {
  data: PublicCompanyPageData | null;
  error: string | null;
};

const publicCompanyColumns = [
  "id",
  "recruiter_id",
  "name",
  "slug",
  "logo_path",
  "banner_path",
  "about",
  "mission",
  "vision",
  "culture",
  "website",
  "industry",
  "company_size",
  "founded_year",
  "headquarters",
  "address",
  "linkedin_url",
  "github_url",
  "x_url",
  "facebook_url",
  "instagram_url",
  "youtube_url",
  "work_model",
  "hiring_status",
  "benefits",
  "verification_status",
  "profile_completion",
  "created_at",
  "moderation_status",
].join(", ");

const relatedCompanyColumns = "name, slug, industry, company_size, about, moderation_status";

function logPublicCompanyError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  if (error && typeof error === "object") {
    const record = error as { code?: unknown; message?: unknown; status?: unknown };
    console.error(context, {
      code: record.code,
      message: record.message,
      status: record.status,
    });
    return;
  }

  console.error(context, { type: typeof error });
}

function normalizeSlug(value: string) {
  return safePublicSlug(value);
}

function normalizePage(value: number) {
  return clampPositivePage(value);
}

function safeText(value: string | null | undefined) {
  return value?.trim() || null;
}

function toPublicCompanyCard(row: PublicCompanyRelatedSourceRow): PublicCompanyCard {
  return {
    companySize: safeText(row.company_size),
    industry: safeText(row.industry),
    name: safeText(row.name) || "Company",
    slug: normalizeSlug(row.slug),
  };
}

async function signedAssetUrl(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  path: string | null,
) {
  if (!path) {
    return null;
  }

  const { data, error } = await admin.storage
    .from("company-assets")
    .createSignedUrl(path, 600);

  if (error) {
    logPublicCompanyError("[public-company] asset URL failed", error);
    return null;
  }

  return data?.signedUrl ?? null;
}

async function findRelatedCompanies(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  company: PublicCompanySourceRow,
) {
  const related = new Map<string, PublicCompanyCard>();

  if (company.industry) {
    const { data, error } = await admin
      .from("companies")
      .select(relatedCompanyColumns)
      .eq("industry", company.industry)
      .eq("moderation_status", "active")
      .neq("slug", company.slug)
      .limit(4);

    if (error) {
      logPublicCompanyError("[public-company] related industry lookup failed", error);
    }

    for (const row of (data ?? []) as PublicCompanyRelatedSourceRow[]) {
      const card = toPublicCompanyCard(row);
      if (card.slug) {
        related.set(card.slug, card);
      }
    }
  }

  if (related.size < 4 && company.company_size) {
    const { data, error } = await admin
      .from("companies")
      .select(relatedCompanyColumns)
      .eq("company_size", company.company_size)
      .eq("moderation_status", "active")
      .neq("slug", company.slug)
      .limit(4 - related.size);

    if (error) {
      logPublicCompanyError("[public-company] related size lookup failed", error);
    }

    for (const row of (data ?? []) as PublicCompanyRelatedSourceRow[]) {
      const card = toPublicCompanyCard(row);
      if (card.slug) {
        related.set(card.slug, card);
      }
    }
  }

  return Array.from(related.values()).slice(0, 4);
}

const loadPublicCompanyPage = cache(
  async (rawSlug: string, requestedPage: number): Promise<PublicCompanyPageResult> => {
    const admin = createSupabaseAdminClient();

    if (!admin) {
      return {
        data: null,
        error: "Company profiles are temporarily unavailable.",
      };
    }

    const slug = normalizeSlug(rawSlug);
    const page = normalizePage(requestedPage);

    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return { data: null, error: null };
    }

    try {
      const { data: companyData, error: companyError } = await admin
        .from("companies")
        .select(publicCompanyColumns)
        .eq("slug", slug)
        .eq("moderation_status", "active")
        .maybeSingle();

      if (companyError) {
        logPublicCompanyError("[public-company] company lookup failed", companyError);
        return { data: null, error: "Company profiles are temporarily unavailable." };
      }

      if (!companyData) {
        return { data: null, error: null };
      }

      const company = companyData as unknown as PublicCompanySourceRow;
      const nowIso = new Date().toISOString();
      const from = (page - 1) * publicCompanyJobsPerPage;
      const to = from + publicCompanyJobsPerPage - 1;
      const jobsQuery = admin
        .from("jobs")
        .select(publicJobListColumns, { count: "exact" })
        .eq("status", "published")
        .eq("moderation_status", "active")
        .not("published_at", "is", null)
        .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .or(`company_id.eq.${company.id},created_by.eq.${company.recruiter_id}`)
        .order("featured", { ascending: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .range(from, to);
      const { count, data: jobsData, error: jobsError } = await jobsQuery;

      if (jobsError) {
        logPublicCompanyError("[public-company] jobs lookup failed", jobsError);
        return { data: null, error: "Company jobs are temporarily unavailable." };
      }

      const jobs = ((jobsData ?? []) as PublicJobListRow[]).map((row) =>
        mapPublicJobListRow({ ...row, company_name: company.name }),
      );
      const totalActiveJobs = count ?? 0;
      const { data: galleryData, error: galleryError } = await admin
        .from("company_gallery")
        .select("alt_text, storage_path")
        .eq("company_id", company.id)
        .order("created_at", { ascending: true })
        .limit(12);

      if (galleryError) {
        logPublicCompanyError("[public-company] gallery lookup failed", galleryError);
      }

      const gallery = await Promise.all(
        ((galleryData ?? []) as Array<{ alt_text: string; storage_path: string }>).map(async (item) => ({
          altText: item.alt_text,
          imageUrl: await signedAssetUrl(admin, item.storage_path),
        })),
      );
      const [logoUrl, bannerUrl, relatedCompanies] = await Promise.all([
        signedAssetUrl(admin, company.logo_path),
        signedAssetUrl(admin, company.banner_path),
        findRelatedCompanies(admin, company),
      ]);

      return {
        data: {
          company: {
            address: safeText(company.address),
            about: safeText(company.about),
            bannerUrl,
            benefits: (company.benefits ?? []).map((benefit) => benefit.trim()).filter(Boolean),
            companySize: safeText(company.company_size),
            culture: safeText(company.culture),
            createdAt: company.created_at,
            facebookUrl: safeHttpUrl(company.facebook_url),
            foundedYear: company.founded_year,
            githubUrl: safeHttpUrl(company.github_url),
            headquarters: safeText(company.headquarters),
            hiringStatus: safeText(company.hiring_status),
            industry: safeText(company.industry),
            instagramUrl: safeHttpUrl(company.instagram_url),
            isVerified: company.verification_status === "verified",
            linkedinUrl: safeHttpUrl(company.linkedin_url),
            logoUrl,
            mission: safeText(company.mission),
            name: safeText(company.name) || "Company",
            profileCompletion: company.profile_completion,
            slug,
            website: safeHttpUrl(company.website),
            vision: safeText(company.vision),
            workModel: safeText(company.work_model),
            xUrl: safeHttpUrl(company.x_url),
            youtubeUrl: safeHttpUrl(company.youtube_url),
          },
          error: null,
          gallery,
          jobs,
          jobsPage: page,
          jobsPageCount: Math.max(1, Math.ceil(totalActiveJobs / publicCompanyJobsPerPage)),
          relatedCompanies,
          totalActiveJobs,
        },
        error: null,
      };
    } catch (error) {
      logPublicCompanyError("[public-company] unexpected page failure", error);
      return { data: null, error: "Company profiles are temporarily unavailable." };
    }
  },
);

export function fetchPublicCompanyPage(slug: string, page = 1) {
  return loadPublicCompanyPage(slug, page);
}
