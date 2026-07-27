import type { MetadataRoute } from "next";
import { loadPublicSitemapData } from "@/lib/sitemap-data";
import { getProductionSiteUrl } from "@/lib/seo";

export const revalidate = 3600;

const staticPublicRoutes = [
  { changeFrequency: "weekly" as const, path: "/", priority: 1 },
  { changeFrequency: "daily" as const, path: "/jobs", priority: 0.9 },
  { changeFrequency: "monthly" as const, path: "/pricing", priority: 0.6 },
];

function getValidDate(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildUrl(path: string, siteUrl: URL) {
  return new URL(path, siteUrl).toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const productionSiteUrl = getProductionSiteUrl();

  if (!productionSiteUrl) {
    return [];
  }

  const data = await loadPublicSitemapData();
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();

  for (const route of staticPublicRoutes) {
    const url = buildUrl(route.path, productionSiteUrl);
    entries.set(url, {
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      url,
    });
  }

  for (const job of data.jobs) {
    if (!job.slug) {
      continue;
    }

    const url = buildUrl(`/jobs/${encodeURIComponent(job.slug)}`, productionSiteUrl);
    entries.set(url, {
      changeFrequency: "weekly",
      lastModified:
        getValidDate(job.updated_at)
        ?? getValidDate(job.published_at)
        ?? getValidDate(job.created_at),
      priority: 0.7,
      url,
    });
  }

  for (const company of data.companies) {
    if (!company.slug) {
      continue;
    }

    const url = buildUrl(
      `/company/${encodeURIComponent(company.slug)}`,
      productionSiteUrl,
    );
    entries.set(url, {
      changeFrequency: "monthly",
      lastModified:
        getValidDate(company.updated_at) ?? getValidDate(company.created_at),
      priority: 0.5,
      url,
    });
  }

  return Array.from(entries.values());
}
