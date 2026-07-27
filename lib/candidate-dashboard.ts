import {
  normalizeApplicationStatus,
  type ApplicationStatus,
} from "@/lib/applications";
import type { CandidateProfile } from "@/lib/candidate-profile";
import {
  fetchPublicJobs,
  type PublicJobFilters,
  type PublicJobListItem,
} from "@/lib/public-jobs";
import { supabase } from "@/lib/supabase";

export const candidateDashboardApplicationLimit = 4;
export const candidateDashboardRecommendationLimit = 3;

export type CandidateDashboardApplication = {
  appliedAt: string | null;
  companyName: string;
  id: string;
  jobSlug: string | null;
  jobTitle: string;
  status: ApplicationStatus;
};

export type CandidateDashboardApplications = {
  error: string | null;
  items: CandidateDashboardApplication[];
  totalCount: number;
};

export type CandidateDashboardRecommendations = {
  error: string | null;
  jobs: PublicJobListItem[];
};

type CandidateDashboardApplicationRow = {
  applied_at?: string | null;
  company_name?: string | null;
  id?: string | null;
  job_slug?: string | null;
  job_title?: string | null;
  status?: string | null;
  total_count?: number | null;
};

function safeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  return 0;
}

function friendlyDashboardError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("authentication") || normalized.includes("jwt")) {
    return "Please sign in again to load your candidate dashboard.";
  }

  if (normalized.includes("network") || normalized.includes("failed to fetch")) {
    return "We could not connect. Please check your internet connection and try again.";
  }

  return "We could not load this dashboard section. Please try again.";
}

export function createEmptyCandidateDashboardApplications(): CandidateDashboardApplications {
  return {
    error: null,
    items: [],
    totalCount: 0,
  };
}

export async function loadCandidateDashboardApplications(
  limit = candidateDashboardApplicationLimit,
): Promise<CandidateDashboardApplications> {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      items: [],
      totalCount: 0,
    };
  }

  try {
    const { data, error } = await supabase.rpc(
      "get_candidate_applications_dashboard",
      {
        p_company: null,
        p_date_from: null,
        p_date_to: null,
        p_limit: limit,
        p_offset: 0,
        p_search: "",
        p_status: null,
      },
    );

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[candidate-dashboard] applications fetch failed", friendlyDashboardError(error));
      }

      return {
        error: friendlyDashboardError(error),
        items: [],
        totalCount: 0,
      };
    }

    const rows = Array.isArray(data)
      ? (data as CandidateDashboardApplicationRow[])
      : [];

    return {
      error: null,
      items: rows.map((row) => ({
        appliedAt: row.applied_at ?? null,
        companyName: safeText(row.company_name, "Company unavailable"),
        id: safeText(row.id, "application"),
        jobSlug: safeText(row.job_slug, "") || null,
        jobTitle: safeText(row.job_title, "Unknown Job"),
        status: normalizeApplicationStatus(row.status),
      })),
      totalCount: safeCount(rows[0]?.total_count),
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[candidate-dashboard] applications network failure", friendlyDashboardError(error));
    }

    return {
      error: friendlyDashboardError(error),
      items: [],
      totalCount: 0,
    };
  }
}

function recommendationFilters(profile: CandidateProfile | null): PublicJobFilters {
  const preferredTitle = profile?.preferred_job_title?.trim() ?? "";
  const preferredLocation = profile?.preferred_location?.trim() ?? "";
  const workplaceType = profile?.work_preference ?? "";

  return {
    category: "",
    employmentType: "",
    experienceLevel: "",
    featured: false,
    location: preferredLocation,
    page: 1,
    query: preferredTitle,
    sort: "newest",
    workplaceType,
  };
}

export async function loadCandidateDashboardRecommendations(
  profile: CandidateProfile | null,
): Promise<CandidateDashboardRecommendations> {
  const filters = recommendationFilters(profile);
  const targetedResult = await fetchPublicJobs(filters);

  if (!targetedResult.error && targetedResult.jobs.length > 0) {
    return {
      error: null,
      jobs: targetedResult.jobs.slice(0, candidateDashboardRecommendationLimit),
    };
  }

  const fallbackResult = await fetchPublicJobs({
    ...filters,
    location: "",
    query: "",
    workplaceType: "",
  });

  if (fallbackResult.error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[candidate-dashboard] recommendations unavailable",
        fallbackResult.error,
      );
    }

    return {
      error: targetedResult.error ?? fallbackResult.error,
      jobs: [],
    };
  }

  return {
    error: null,
    jobs: fallbackResult.jobs.slice(0, candidateDashboardRecommendationLimit),
  };
}
