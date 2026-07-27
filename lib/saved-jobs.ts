import {
  formatEmploymentType,
  formatExperienceLevel,
  formatWorkplaceType,
  isEmploymentType,
  isExperienceLevel,
  isWorkplaceType,
  type Salary,
} from "@/lib/jobs";
import { supabase } from "@/lib/supabase";

export const savedJobsPageSize = 10;

export type SavedJobsSort =
  | "newest_job"
  | "oldest_job"
  | "oldest"
  | "recent";

export type SavedJobsFilters = {
  employmentType: string;
  location: string;
  search: string;
  sort: SavedJobsSort;
  workplaceType: string;
};

export type SavedJob = {
  availabilityStatus: "available" | "unavailable";
  companyName: string;
  employmentType: string | null;
  experienceLevel: string | null;
  featured: boolean;
  hasApplied: boolean;
  jobSlug: string | null;
  jobTitle: string;
  location: string | null;
  postedAt: string | null;
  salary: Salary;
  savedAt: string | null;
  workplaceType: string | null;
};

export type SavedJobsResult = {
  error: string | null;
  jobs: SavedJob[];
  page: number;
  pageCount: number;
  totalCount: number;
};

export type CandidateSavedJobsSummary = {
  error: string | null;
  recentJobs: SavedJob[];
  savedCount: number;
};

export function createEmptyCandidateSavedJobsSummary(): CandidateSavedJobsSummary {
  return {
    error: null,
    recentJobs: [],
    savedCount: 0,
  };
}

type SavedJobRow = {
  availability_status?: string | null;
  company_name?: string | null;
  employment_type?: string | null;
  experience_level?: string | null;
  featured?: boolean | null;
  has_applied?: boolean | null;
  job_slug?: string | null;
  job_title?: string | null;
  location?: string | null;
  posted_at?: string | null;
  salary_currency?: string | null;
  salary_max?: number | string | null;
  salary_min?: number | string | null;
  salary_visible?: boolean | null;
  saved_at?: string | null;
  total_count?: number | string | null;
  workplace_type?: string | null;
};

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function safeCount(value: unknown) {
  const count = safeNumber(value);

  return count && count > 0 ? Math.floor(count) : 0;
}

function normalizeSort(value: SavedJobsSort | string | undefined): SavedJobsSort {
  return value === "oldest" ||
    value === "newest_job" ||
    value === "oldest_job"
    ? value
    : "recent";
}

function normalizeSavedJobRow(row: SavedJobRow): SavedJob {
  const available = row.availability_status === "available";
  const employmentType = isEmploymentType(row.employment_type)
    ? formatEmploymentType(row.employment_type)
    : null;
  const experienceLevel = isExperienceLevel(row.experience_level)
    ? formatExperienceLevel(row.experience_level)
    : null;
  const workplaceType = isWorkplaceType(row.workplace_type)
    ? formatWorkplaceType(row.workplace_type)
    : null;
  const currency = safeString(row.salary_currency, "USD").toUpperCase();

  return {
    availabilityStatus: available ? "available" : "unavailable",
    companyName: safeString(row.company_name, "Company unavailable"),
    employmentType,
    experienceLevel,
    featured: available && row.featured === true,
    hasApplied: available && row.has_applied === true,
    jobSlug: safeString(row.job_slug) || null,
    jobTitle: safeString(
      row.job_title,
      available ? "Untitled role" : "This job is no longer available.",
    ),
    location: available ? safeString(row.location) || null : null,
    postedAt: available ? row.posted_at ?? null : null,
    salary: {
      currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
      max: available ? safeNumber(row.salary_max) : null,
      min: available ? safeNumber(row.salary_min) : null,
      visible: available && row.salary_visible === true,
    },
    savedAt: row.saved_at ?? null,
    workplaceType,
  };
}

function getErrorText(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const record = error as {
    code?: unknown;
    message?: unknown;
  };

  return [record.code, record.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

export function getFriendlySavedJobsError(error: unknown) {
  const errorText = getErrorText(error);

  if (errorText.includes("job_seeker_required")) {
    return "Saved Jobs are available only for Job Seeker accounts.";
  }

  if (errorText.includes("authentication_required") || errorText.includes("jwt")) {
    return "Please log in again to view your saved jobs.";
  }

  if (errorText.includes("does not exist") || errorText.includes("schema cache")) {
    return "Saved Jobs are not ready yet. Please run the latest Supabase migration.";
  }

  if (
    errorText.includes("failed to fetch") ||
    errorText.includes("network") ||
    errorText.includes("timeout")
  ) {
    return "We could not connect. Please check your internet connection and try again.";
  }

  return "We could not load your saved jobs. Please try again.";
}

export function getFriendlySavedJobActionError(error: unknown) {
  const errorText = getErrorText(error);

  if (errorText.includes("job_not_available")) {
    return "This job is no longer available to save.";
  }

  if (errorText.includes("job_seeker_required")) {
    return "Only Job Seeker accounts can save jobs.";
  }

  if (errorText.includes("authentication_required") || errorText.includes("jwt")) {
    return "Please log in again before saving a job.";
  }

  if (errorText.includes("failed to fetch") || errorText.includes("network")) {
    return "We could not connect. Please check your internet connection and try again.";
  }

  return "We could not update your saved jobs. Please try again.";
}

export async function loadCandidateSavedJobs(
  filters: SavedJobsFilters,
  page: number,
): Promise<SavedJobsResult> {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      jobs: [],
      page,
      pageCount: 1,
      totalCount: 0,
    };
  }

  try {
    const { data, error } = await supabase.rpc("get_candidate_saved_jobs", {
      p_employment_type: filters.employmentType || null,
      p_limit: savedJobsPageSize,
      p_location: filters.location,
      p_offset: Math.max(0, page - 1) * savedJobsPageSize,
      p_search: filters.search,
      p_sort: normalizeSort(filters.sort),
      p_workplace_type: filters.workplaceType || null,
    });

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[saved-jobs] list fetch failed", getErrorText(error));
      }

      return {
        error: getFriendlySavedJobsError(error),
        jobs: [],
        page,
        pageCount: 1,
        totalCount: 0,
      };
    }

    const rows = Array.isArray(data) ? (data as SavedJobRow[]) : [];
    const totalCount = safeCount(rows[0]?.total_count);

    return {
      error: null,
      jobs: rows.map(normalizeSavedJobRow),
      page,
      pageCount: Math.max(1, Math.ceil(totalCount / savedJobsPageSize)),
      totalCount,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[saved-jobs] list network failure", getErrorText(error));
    }

    return {
      error: getFriendlySavedJobsError(error),
      jobs: [],
      page,
      pageCount: 1,
      totalCount: 0,
    };
  }
}

export async function loadCandidateSavedJobsSummary(): Promise<CandidateSavedJobsSummary> {
  const result = await loadCandidateSavedJobs(
    {
      employmentType: "",
      location: "",
      search: "",
      sort: "recent",
      workplaceType: "",
    },
    1,
  );

  return {
    error: result.error,
    recentJobs: result.jobs.slice(0, 3),
    savedCount: result.totalCount,
  };
}
