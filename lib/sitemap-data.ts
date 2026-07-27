import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

const sitemapPageSize = 1000;

type SitemapJobRow = {
  created_at: string | null;
  published_at: string | null;
  slug: string | null;
  updated_at: string | null;
};

type SitemapCompanyRow = {
  created_at: string | null;
  slug: string | null;
  updated_at: string | null;
};

export type PublicSitemapData = {
  companies: SitemapCompanyRow[];
  jobs: SitemapJobRow[];
};

function logSitemapFailure(context: string) {
  if (process.env.NODE_ENV === "development") {
    console.error(`[sitemap] ${context}`);
  }
}

function isValidPublicSlug(value: string | null) {
  return Boolean(value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value));
}

async function loadPublicJobs() {
  const database = createSupabaseAdminClient() ?? supabase;

  if (!database) {
    return [];
  }

  const jobs: SitemapJobRow[] = [];

  try {
    for (let offset = 0; ; offset += sitemapPageSize) {
      const nowIso = new Date().toISOString();
      const { data, error } = await database
        .from("jobs")
        .select("slug, updated_at, published_at, created_at")
        .eq("status", "published")
        .eq("moderation_status", "active")
        .not("published_at", "is", null)
        .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("published_at", { ascending: false, nullsFirst: false })
        .range(offset, offset + sitemapPageSize - 1);

      if (error) {
        logSitemapFailure("public job lookup failed");
        return jobs;
      }

      const page = (data ?? []) as SitemapJobRow[];
      jobs.push(...page.filter((job) => isValidPublicSlug(job.slug)));

      if (page.length < sitemapPageSize) {
        return jobs;
      }
    }
  } catch {
    logSitemapFailure("public job lookup was unavailable");
    return jobs;
  }
}

async function loadPublicCompanies() {
  const database = createSupabaseAdminClient();

  if (!database) {
    return [];
  }

  const companies: SitemapCompanyRow[] = [];

  try {
    for (let offset = 0; ; offset += sitemapPageSize) {
      const { data, error } = await database
        .from("companies")
        .select("slug, updated_at, created_at")
        .eq("moderation_status", "active")
        .not("slug", "is", null)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .range(offset, offset + sitemapPageSize - 1);

      if (error) {
        logSitemapFailure("public company lookup failed");
        return companies;
      }

      const page = (data ?? []) as SitemapCompanyRow[];
      companies.push(
        ...page.filter((company) => isValidPublicSlug(company.slug)),
      );

      if (page.length < sitemapPageSize) {
        return companies;
      }
    }
  } catch {
    logSitemapFailure("public company lookup was unavailable");
    return companies;
  }
}

export async function loadPublicSitemapData(): Promise<PublicSitemapData> {
  const [jobs, companies] = await Promise.all([
    loadPublicJobs(),
    loadPublicCompanies(),
  ]);

  return { companies, jobs };
}
