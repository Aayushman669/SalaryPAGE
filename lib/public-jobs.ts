import {
  employmentTypes,
  experienceLevels,
  formatEmploymentType,
  formatExperienceLevel,
  formatSalary,
  formatWorkplaceType,
  isEmploymentType,
  isExperienceLevel,
  isWorkplaceType,
  type EmploymentType,
  type ExperienceLevel,
  type Salary,
  type WorkplaceType,
  workplaceTypes,
} from "@/lib/jobs";
import { cache } from "react";
import { supabase } from "@/lib/supabase";
import { clampPositivePage, safeHttpUrl, safePublicSlug } from "@/lib/input-safety";

export const publicJobsPerPage = 9;

export const publicJobSortOptions = [
  "newest",
  "oldest",
  "featured",
  "salary_high",
  "salary_low",
] as const;

export type PublicJobSort = (typeof publicJobSortOptions)[number];

export type PublicJobFilters = {
  category: string;
  employmentType: EmploymentType | "";
  experienceLevel: ExperienceLevel | "";
  featured: boolean;
  location: string;
  page: number;
  query: string;
  sort: PublicJobSort;
  workplaceType: WorkplaceType | "";
};

export type PublicJobListItem = {
  applicationsCount: number;
  category: string;
  companyName: string;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel | null;
  expiresAt: string | null;
  featured: boolean;
  location: string;
  moderationStatus: string | null;
  postedAt: string | null;
  publishAt: string | null;
  publishedAt: string | null;
  salary: Salary;
  slug: string;
  status: string | null;
  title: string;
  workplaceType: WorkplaceType;
};

export type PublicJobDetails = PublicJobListItem & {
  applicationEmail: string | null;
  applicationUrl: string | null;
  benefits: string;
  description: string;
  requirements: string;
};

export type PublicJobListRow = {
  applications_count?: number | null;
  category?: string | null;
  company_name?: string | null;
  created_at?: string | null;
  employment_type?: string | null;
  experience_level?: string | null;
  expires_at?: string | null;
  featured?: boolean | null;
  location?: string | null;
  moderation_status?: string | null;
  publish_at?: string | null;
  published_at?: string | null;
  salary_currency?: string | null;
  salary_max?: number | null;
  salary_min?: number | null;
  salary_visible?: boolean | null;
  slug?: string | null;
  status?: string | null;
  title?: string | null;
  workplace_type?: string | null;
};

type PublicJobDetailsRow = PublicJobListRow & {
  application_email?: string | null;
  application_url?: string | null;
  benefits?: string | null;
  description?: string | null;
  requirements?: string | null;
};

export type PublicJobsResult = {
  error: string | null;
  jobs: PublicJobListItem[];
  page: number;
  pageCount: number;
  totalCount: number;
};

type PublicJobsQueryOptions = {
  includeCount?: boolean;
  limit?: number;
};

export type PublicJobDetailsResult = {
  error: string | null;
  job: PublicJobDetails | null;
};

export const publicJobListColumns = [
  "slug",
  "title",
  "company_name",
  "location",
  "employment_type",
  "workplace_type",
  "experience_level",
  "category",
  "salary_min",
  "salary_max",
  "salary_currency",
  "salary_visible",
  "status",
  "featured",
  "publish_at",
  "published_at",
  "expires_at",
  "created_at",
  "applications_count",
  "moderation_status",
].join(", ");

const publicJobDetailsColumns = [
  publicJobListColumns,
  "description",
  "requirements",
  "benefits",
  "application_url",
  "application_email",
].join(", ");

const sortLabels: Record<PublicJobSort, string> = {
  featured: "Featured",
  newest: "Newest",
  oldest: "Oldest",
  salary_high: "Salary High to Low",
  salary_low: "Salary Low to High",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizePage(value: string | string[] | undefined) {
  const page = Number(firstParam(value));

  return clampPositivePage(page);
}

function normalizeSort(value: string | string[] | undefined): PublicJobSort {
  const sort = firstParam(value);

  return publicJobSortOptions.includes(sort as PublicJobSort)
    ? (sort as PublicJobSort)
    : "newest";
}

function normalizeSearchForPostgrest(value: string) {
  return value
    .replace(/[%(),]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function normalizeCurrency(value: string | null | undefined) {
  const currency = normalizeText(value).toUpperCase();

  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeCount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function getPublicPostedAt(row: PublicJobListRow) {
  const publishedAt = row.published_at ?? row.created_at ?? null;
  const publishAt = row.publish_at ?? null;

  if (!publishAt || !publishedAt) {
    return publishAt ?? publishedAt;
  }

  const publishedDate = new Date(publishedAt);
  const publishDate = new Date(publishAt);

  if (
    Number.isNaN(publishedDate.getTime()) ||
    Number.isNaN(publishDate.getTime())
  ) {
    return publishedAt;
  }

  return publishDate > publishedDate ? publishAt : publishedAt;
}

function normalizeEmploymentType(value: string | null | undefined) {
  return isEmploymentType(value) ? value : "full_time";
}

function normalizeWorkplaceType(value: string | null | undefined) {
  return isWorkplaceType(value) ? value : "remote";
}

function normalizeExperienceLevel(value: string | null | undefined) {
  return isExperienceLevel(value) ? value : null;
}

export function mapPublicJobListRow(row: PublicJobListRow): PublicJobListItem {
  const salaryVisible = row.salary_visible ?? true;

  return {
    applicationsCount: safeCount(row.applications_count),
    category: normalizeText(row.category) || "General",
    companyName: normalizeText(row.company_name) || "Company",
    employmentType: normalizeEmploymentType(row.employment_type),
    experienceLevel: normalizeExperienceLevel(row.experience_level),
    expiresAt: row.expires_at ?? null,
    featured: row.featured === true,
    location: normalizeText(row.location) || "Location not specified",
    moderationStatus: normalizeText(row.moderation_status) || null,
    postedAt: getPublicPostedAt(row),
    publishAt: row.publish_at ?? null,
    publishedAt: row.published_at ?? null,
    salary: {
      currency: normalizeCurrency(row.salary_currency),
      max: safeNumber(row.salary_max),
      min: safeNumber(row.salary_min),
      visible: salaryVisible,
    },
    slug: normalizeText(row.slug),
    status: normalizeText(row.status) || null,
    title: normalizeText(row.title) || "Untitled role",
    workplaceType: normalizeWorkplaceType(row.workplace_type),
  };
}

function mapPublicJobDetailsRow(row: PublicJobDetailsRow): PublicJobDetails {
  return {
    ...mapPublicJobListRow(row),
    applicationEmail: normalizeText(row.application_email) || null,
    applicationUrl: safeHttpUrl(row.application_url),
    benefits: row.benefits?.trim() ?? "",
    description: row.description?.trim() ?? "",
    requirements: row.requirements?.trim() ?? "",
  };
}

function getFriendlyPublicJobsError(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Jobs are unavailable right now. Please try again soon.";
  }

  const errorRecord = error as { message?: unknown };
  const message =
    typeof errorRecord.message === "string" ? errorRecord.message : "";
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("does not exist") ||
    lowerMessage.includes("column") ||
    lowerMessage.includes("relation")
  ) {
    return "Jobs storage is not ready yet. Please run the latest jobs migration in Supabase.";
  }

  return "Jobs are unavailable right now. Please try again soon.";
}

export function parsePublicJobFilters(
  searchParams: Record<string, string | string[] | undefined>,
): PublicJobFilters {
  const employmentType = firstParam(searchParams.employment_type);
  const workplaceType = firstParam(searchParams.workplace_type);
  const experienceLevel = firstParam(searchParams.experience_level);

  return {
    category: normalizeText(firstParam(searchParams.category)),
    employmentType: isEmploymentType(employmentType) ? employmentType : "",
    experienceLevel: isExperienceLevel(experienceLevel) ? experienceLevel : "",
    featured: firstParam(searchParams.featured) === "true",
    location: normalizeText(firstParam(searchParams.location)),
    page: normalizePage(searchParams.page),
    query: normalizeText(firstParam(searchParams.q)),
    sort: normalizeSort(searchParams.sort),
    workplaceType: isWorkplaceType(workplaceType) ? workplaceType : "",
  };
}

export function getPublicJobSortLabel(sort: PublicJobSort) {
  return sortLabels[sort];
}

export function formatPublicJobEmploymentType(value: EmploymentType) {
  return formatEmploymentType(value);
}

export function formatPublicJobWorkplaceType(value: WorkplaceType) {
  return formatWorkplaceType(value);
}

export function formatPublicJobExperience(value: ExperienceLevel | null) {
  return value ? formatExperienceLevel(value) : "Experience not specified";
}

export function formatPublicJobSalary(salary: Salary) {
  return formatSalary(salary);
}

export function formatPostedTime(value: string | null) {
  if (!value) {
    return "Recently posted";
  }

  const postedDate = new Date(value);

  if (Number.isNaN(postedDate.getTime())) {
    return "Recently posted";
  }

  const diffMs = Date.now() - postedDate.getTime();
  const dayMs = 1000 * 60 * 60 * 24;
  const days = Math.floor(diffMs / dayMs);

  if (days <= 0) {
    return "Posted today";
  }

  if (days === 1) {
    return "Posted yesterday";
  }

  if (days < 30) {
    return `Posted ${days} days ago`;
  }

  return `Posted ${new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(postedDate)}`;
}

export function createJobsHref(
  filters: PublicJobFilters,
  overrides: Partial<
    Record<
      | "category"
      | "employment_type"
      | "experience_level"
      | "featured"
      | "location"
      | "page"
      | "q"
      | "sort"
      | "workplace_type",
      string | number | boolean | null
    >
  >,
) {
  const params = new URLSearchParams();
  const values = {
    category: filters.category,
    employment_type: filters.employmentType,
    experience_level: filters.experienceLevel,
    featured: filters.featured ? "true" : "",
    location: filters.location,
    page: filters.page > 1 ? String(filters.page) : "",
    q: filters.query,
    sort: filters.sort === "newest" ? "" : filters.sort,
    workplace_type: filters.workplaceType,
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === "" || value === false) {
      continue;
    }

    params.set(key, String(value));
  }

  const queryString = params.toString();

  return queryString ? `/jobs?${queryString}` : "/jobs";
}

export async function fetchPublicJobs(
  filters: PublicJobFilters,
  options: PublicJobsQueryOptions = {},
): Promise<PublicJobsResult> {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      jobs: [],
      page: filters.page,
      pageCount: 1,
      totalCount: 0,
    };
  }

  try {
    const pageSize =
      typeof options.limit === "number" && Number.isInteger(options.limit)
        ? Math.min(Math.max(options.limit, 1), 50)
        : publicJobsPerPage;
    const from = (filters.page - 1) * pageSize;
    const to = from + pageSize - 1;
    const jobsQuery = supabase.from("jobs");
    let query =
      options.includeCount === false
        ? jobsQuery.select(publicJobListColumns)
        : jobsQuery.select(publicJobListColumns, { count: "exact" });

    query = query
      .eq("status", "published")
      .eq("moderation_status", "active")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`);

    const search = normalizeSearchForPostgrest(filters.query);

    if (search) {
      const pattern = `%${search}%`;
      query = query.or(
        [
          `title.ilike.${pattern}`,
          `company_name.ilike.${pattern}`,
          `location.ilike.${pattern}`,
          `category.ilike.${pattern}`,
        ].join(","),
      );
    }

    if (filters.employmentType) {
      query = query.eq("employment_type", filters.employmentType);
    }

    if (filters.workplaceType) {
      query = query.eq("workplace_type", filters.workplaceType);
    }

    if (filters.experienceLevel) {
      query = query.eq("experience_level", filters.experienceLevel);
    }

    if (filters.category) {
      query = query.ilike("category", `%${normalizeSearchForPostgrest(filters.category)}%`);
    }

    if (filters.location) {
      query = query.ilike("location", `%${normalizeSearchForPostgrest(filters.location)}%`);
    }

    if (filters.featured) {
      query = query.eq("featured", true);
    }

    if (filters.sort === "oldest") {
      query = query.order("published_at", {
        ascending: true,
        nullsFirst: false,
      });
    } else if (filters.sort === "featured") {
      query = query
        .order("featured", { ascending: false })
        .order("published_at", { ascending: false, nullsFirst: false });
    } else if (filters.sort === "salary_high") {
      query = query
        .order("salary_visible", { ascending: false })
        .order("salary_max", {
          ascending: false,
          nullsFirst: false,
        });
    } else if (filters.sort === "salary_low") {
      query = query
        .order("salary_visible", { ascending: false })
        .order("salary_min", {
          ascending: true,
          nullsFirst: false,
        });
    } else {
      query = query.order("published_at", {
        ascending: false,
        nullsFirst: false,
      });
    }

    const { count, data, error } = await query.range(from, to);

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[public-jobs] list fetch failed", error);
      }

      return {
        error: getFriendlyPublicJobsError(error),
        jobs: [],
        page: filters.page,
        pageCount: 1,
        totalCount: 0,
      };
    }

    const totalCount = count ?? data?.length ?? 0;

    return {
      error: null,
      jobs: ((data ?? []) as PublicJobListRow[])
        .map(mapPublicJobListRow)
        .filter((job) => job.slug),
      page: filters.page,
      pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
      totalCount,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[public-jobs] list fetch network failure", error);
    }

    return {
      error: getFriendlyPublicJobsError(error),
      jobs: [],
      page: filters.page,
      pageCount: 1,
      totalCount: 0,
    };
  }
}

export const fetchPublicJobBySlug = cache(async function fetchPublicJobBySlug(
  slug: string,
): Promise<PublicJobDetailsResult> {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      job: null,
    };
  }

  const normalizedSlug = safePublicSlug(slug);

  if (!normalizedSlug) {
    return { error: null, job: null };
  }

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("jobs")
      .select(publicJobDetailsColumns)
      .eq("status", "published")
      .eq("moderation_status", "active")
      .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .eq("slug", normalizedSlug)
      .maybeSingle();

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[public-jobs] details fetch failed", error);
      }

      return {
        error: getFriendlyPublicJobsError(error),
        job: null,
      };
    }

    return {
      error: null,
      job: data ? mapPublicJobDetailsRow(data as PublicJobDetailsRow) : null,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[public-jobs] details fetch network failure", error);
    }

    return {
      error: getFriendlyPublicJobsError(error),
      job: null,
    };
  }
});

export async function searchPublicJobs(query: string, limit = 5) {
  if (!supabase) {
    return [];
  }

  const search = normalizeSearchForPostgrest(query);
  const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 10) : 5;

  if (!search) {
    return [];
  }

  try {
    const pattern = `%${search}%`;
    const { data, error } = await supabase
      .from("jobs")
      .select(publicJobListColumns)
      .eq("status", "published")
      .eq("moderation_status", "active")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
      .or(
        [
          `title.ilike.${pattern}`,
          `company_name.ilike.${pattern}`,
          `location.ilike.${pattern}`,
          `category.ilike.${pattern}`,
        ].join(","),
      )
      .order("featured", { ascending: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(safeLimit);

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[public-jobs] search fetch failed", error);
      }

      return [];
    }

    return ((data ?? []) as PublicJobListRow[])
      .map(mapPublicJobListRow)
      .filter((job) => job.slug);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[public-jobs] search fetch network failure", error);
    }

    return [];
  }
}

export const publicEmploymentTypeOptions = employmentTypes;
export const publicWorkplaceTypeOptions = workplaceTypes;
export const publicExperienceLevelOptions = experienceLevels;
