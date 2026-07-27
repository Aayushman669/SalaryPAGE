import "server-only";

import { cache } from "react";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import {
  fetchPublicJobBySlug,
  fetchPublicJobs,
  type PublicJobFilters,
} from "@/lib/public-jobs";
import { fetchPublicCompanyPage } from "@/lib/public-company";
import { clampPositivePage } from "@/lib/input-safety";

export const PUBLIC_JOBS_CACHE_TAG = "public-jobs";
export const PUBLIC_COMPANIES_CACHE_TAG = "public-companies";

const publicJobCacheSeconds = 60;
const publicCompanyCacheSeconds = 240;

function cacheSegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 120) || "unknown";
}

export function publicJobCacheTag(slug: string) {
  return `public-job:${cacheSegment(slug)}`;
}

export function publicCompanyCacheTag(slug: string) {
  return `public-company:${cacheSegment(slug)}`;
}

function isDefaultPublicJobsQuery(filters: PublicJobFilters) {
  return (
    filters.category === "" &&
    filters.employmentType === "" &&
    filters.experienceLevel === "" &&
    filters.featured === false &&
    filters.location === "" &&
    filters.query === "" &&
    filters.sort === "newest" &&
    filters.workplaceType === ""
  );
}

const loadCachedPublicJobsPage = cache(async (page: number) => {
  const defaultFilters: PublicJobFilters = {
    category: "",
    employmentType: "",
    experienceLevel: "",
    featured: false,
    location: "",
    page,
    query: "",
    sort: "newest",
    workplaceType: "",
  };

  const load = unstable_cache(
    async () => {
      const result = await fetchPublicJobs(defaultFilters);

      if (result.error) {
        throw new Error("Public jobs cache read failed.");
      }

      return result;
    },
    ["public-jobs", String(page)],
    {
      revalidate: publicJobCacheSeconds,
      tags: [PUBLIC_JOBS_CACHE_TAG],
    },
  );

  try {
    return await load();
  } catch {
    return fetchPublicJobs(defaultFilters);
  }
});

export async function fetchCachedPublicJobs(filters: PublicJobFilters) {
  if (!isDefaultPublicJobsQuery(filters)) {
    return fetchPublicJobs(filters);
  }

  return loadCachedPublicJobsPage(filters.page);
}

export const fetchCachedPublicJobBySlug = cache(async (rawSlug: string) => {
  const slug = rawSlug.trim().toLowerCase();

  if (!slug) {
    return fetchPublicJobBySlug(rawSlug);
  }

  const load = unstable_cache(
    async () => {
      const result = await fetchPublicJobBySlug(slug);

      if (result.error) {
        throw new Error("Public job cache read failed.");
      }

      return result;
    },
    ["public-job", cacheSegment(slug)],
    {
      revalidate: publicJobCacheSeconds,
      tags: [PUBLIC_JOBS_CACHE_TAG, publicJobCacheTag(slug)],
    },
  );

  try {
    return await load();
  } catch {
    return fetchPublicJobBySlug(slug);
  }
});

export const fetchCachedPublicCompanyPage = cache(
  async (rawSlug: string, page = 1) => {
    const slug = rawSlug.trim().toLowerCase();
    const safePage = clampPositivePage(page);

    if (!slug) {
      return fetchPublicCompanyPage(rawSlug, safePage);
    }

    const load = unstable_cache(
      async () => {
        const result = await fetchPublicCompanyPage(slug, safePage);

        if (result.error) {
          throw new Error("Public company cache read failed.");
        }

        return result;
      },
      ["public-company", cacheSegment(slug), String(safePage)],
      {
        revalidate: publicCompanyCacheSeconds,
        tags: [PUBLIC_COMPANIES_CACHE_TAG, publicCompanyCacheTag(slug)],
      },
    );

    try {
      return await load();
    } catch {
      return fetchPublicCompanyPage(slug, safePage);
    }
  },
);

export function revalidatePublicJobCaches(slug?: string | null) {
  revalidateTag(PUBLIC_JOBS_CACHE_TAG, "max");

  if (slug) {
    revalidateTag(publicJobCacheTag(slug), "max");
  }

  revalidatePath("/sitemap.xml");
}

export function revalidatePublicCompanyCaches(slug?: string | null) {
  revalidateTag(PUBLIC_COMPANIES_CACHE_TAG, "max");

  if (slug) {
    revalidateTag(publicCompanyCacheTag(slug), "max");
  }

  revalidatePath("/sitemap.xml");
}
