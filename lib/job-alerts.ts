import {
  employmentTypes,
  experienceLevels,
  formatEmploymentType,
  formatExperienceLevel,
  formatWorkplaceType,
  isEmploymentType,
  isExperienceLevel,
  isWorkplaceType,
  workplaceTypes,
  type EmploymentType,
  type ExperienceLevel,
  type WorkplaceType,
} from "@/lib/jobs";
import { supabase } from "@/lib/supabase";

export const jobAlertsPageSize = 10;
export const jobAlertKeywordLimit = 20;

export const jobAlertFrequencies = ["instant", "daily", "weekly"] as const;
export type JobAlertFrequency = (typeof jobAlertFrequencies)[number];

export type JobAlert = {
  alertName: string;
  candidateId: string;
  createdAt: string | null;
  enabled: boolean;
  frequency: JobAlertFrequency;
  experienceLevel: ExperienceLevel | null;
  employmentType: EmploymentType | null;
  id: string;
  keywords: string[];
  location: string | null;
  salaryMin: number | null;
  updatedAt: string | null;
  workModel: WorkplaceType | null;
};

export type JobAlertForm = {
  alertName: string;
  enabled: boolean;
  experienceLevel: string;
  employmentType: string;
  id?: string;
  keywordsText: string;
  location: string;
  salaryMin: string;
  workModel: string;
};

export type JobAlertValidation = {
  errors: Partial<Record<keyof JobAlertForm, string>>;
  valid: boolean;
};

export type JobAlertsResult = {
  alerts: JobAlert[];
  enabledCount: number;
  error: string | null;
  page: number;
  pageCount: number;
  totalCount: number;
};

export type JobAlertsSummary = {
  enabledCount: number;
  error: string | null;
  recentAlerts: JobAlert[];
  totalCount: number;
};

export function createEmptyCandidateJobAlertsSummary(): JobAlertsSummary {
  return {
    enabledCount: 0,
    error: null,
    recentAlerts: [],
    totalCount: 0,
  };
}

export const emptyJobAlertForm: JobAlertForm = {
  alertName: "",
  enabled: true,
  experienceLevel: "",
  employmentType: "",
  keywordsText: "",
  location: "",
  salaryMin: "",
  workModel: "",
};

type JobAlertRow = {
  alert_name?: string | null;
  candidate_id?: string | null;
  created_at?: string | null;
  enabled?: boolean | null;
  frequency?: string | null;
  enabled_count?: number | string | null;
  experience_level?: string | null;
  employment_type?: string | null;
  id?: string | null;
  keywords?: string[] | null;
  location?: string | null;
  salary_min?: number | string | null;
  total_count?: number | string | null;
  updated_at?: string | null;
  work_model?: string | null;
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

export function parseJobAlertKeywords(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((keyword) => keyword.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function validateJobAlertForm(form: JobAlertForm): JobAlertValidation {
  const errors: JobAlertValidation["errors"] = {};
  const name = form.alertName.trim();
  const location = form.location.trim();
  const keywords = parseJobAlertKeywords(form.keywordsText);

  if (name.length < 2 || name.length > 120) {
    errors.alertName = "Alert name must be between 2 and 120 characters.";
  }

  if (location.length > 160) {
    errors.location = "Location must be 160 characters or fewer.";
  }

  if (parseJobAlertKeywords(form.keywordsText).length > jobAlertKeywordLimit) {
    errors.keywordsText = `Use up to ${jobAlertKeywordLimit} keywords.`;
  }

  if (keywords.some((keyword) => keyword.length > 80)) {
    errors.keywordsText = "Each keyword must be 80 characters or fewer.";
  }

  if (form.employmentType && !isEmploymentType(form.employmentType)) {
    errors.employmentType = "Choose a valid employment type.";
  }

  if (form.workModel && !isWorkplaceType(form.workModel)) {
    errors.workModel = "Choose a valid work model.";
  }

  if (form.experienceLevel && !isExperienceLevel(form.experienceLevel)) {
    errors.experienceLevel = "Choose a valid experience level.";
  }

  if (form.salaryMin.trim()) {
    const salary = Number(form.salaryMin);

    if (!Number.isFinite(salary) || salary < 0) {
      errors.salaryMin = "Minimum salary must be a valid non-negative number.";
    }
  }

  return { errors, valid: Object.keys(errors).length === 0 };
}

export function formatJobAlertSummary(alert: JobAlert) {
  const parts = [
    alert.keywords.length > 0 ? alert.keywords.join(", ") : "Any keywords",
    alert.location || "Any location",
    alert.employmentType
      ? formatEmploymentType(alert.employmentType)
      : "Any employment",
    alert.workModel ? formatWorkplaceType(alert.workModel) : "Any workplace",
    alert.experienceLevel
      ? formatExperienceLevel(alert.experienceLevel)
      : "Any experience",
  ];

  return parts.join(" - ");
}

export function jobAlertToForm(alert: JobAlert): JobAlertForm {
  return {
    alertName: alert.alertName,
    enabled: alert.enabled,
    experienceLevel: alert.experienceLevel ?? "",
    employmentType: alert.employmentType ?? "",
    id: alert.id,
    keywordsText: alert.keywords.join(", "),
    location: alert.location ?? "",
    salaryMin: alert.salaryMin === null ? "" : String(alert.salaryMin),
    workModel: alert.workModel ?? "",
  };
}

function normalizeJobAlertRow(row: JobAlertRow): JobAlert {
  return {
    alertName: safeString(row.alert_name, "Untitled alert"),
    candidateId: safeString(row.candidate_id, "candidate"),
    createdAt: row.created_at ?? null,
    enabled: row.enabled === true,
    frequency: jobAlertFrequencies.includes(row.frequency as JobAlertFrequency)
      ? (row.frequency as JobAlertFrequency)
      : "daily",
    experienceLevel: isExperienceLevel(row.experience_level)
      ? row.experience_level
      : null,
    employmentType: isEmploymentType(row.employment_type)
      ? row.employment_type
      : null,
    id: safeString(row.id, "alert"),
    keywords: Array.isArray(row.keywords)
      ? row.keywords.filter((keyword): keyword is string => typeof keyword === "string")
      : [],
    location: safeString(row.location) || null,
    salaryMin: safeNumber(row.salary_min),
    updatedAt: row.updated_at ?? null,
    workModel: isWorkplaceType(row.work_model) ? row.work_model : null,
  };
}

function getErrorText(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const value = error as { code?: unknown; message?: unknown };
  return [value.code, value.message]
    .filter((item): item is string => typeof item === "string")
    .join(" ")
    .toLowerCase();
}

export function getFriendlyJobAlertError(error: unknown) {
  const errorText = getErrorText(error);

  if (errorText.includes("job_seeker_required")) {
    return "Job Alerts are available only for Job Seeker accounts.";
  }

  if (errorText.includes("authentication_required") || errorText.includes("jwt")) {
    return "Please log in again to manage your job alerts.";
  }

  if (errorText.includes("alert_not_found")) {
    return "That job alert is no longer available.";
  }

  if (errorText.includes("does not exist") || errorText.includes("schema cache")) {
    return "Job Alerts are not ready yet. Please run the latest Supabase migration.";
  }

  if (errorText.includes("failed to fetch") || errorText.includes("network")) {
    return "We could not connect. Please check your internet connection and try again.";
  }

  return "We could not update your job alerts. Please try again.";
}

export async function loadCandidateJobAlerts(
  page = 1,
  pageSize = jobAlertsPageSize,
): Promise<JobAlertsResult> {
  if (!supabase) {
    return {
      alerts: [],
      enabledCount: 0,
      error: "Supabase is not configured. Please check your environment variables.",
      page,
      pageCount: 1,
      totalCount: 0,
    };
  }

  try {
    const { data, error } = await supabase.rpc(
      "get_candidate_job_alerts_with_frequency",
      {
      p_limit: pageSize,
      p_offset: Math.max(0, page - 1) * pageSize,
      },
    );

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[job-alerts] list fetch failed", getErrorText(error));
      }

      return {
        alerts: [],
        enabledCount: 0,
        error: getFriendlyJobAlertError(error),
        page,
        pageCount: 1,
        totalCount: 0,
      };
    }

    const rows = Array.isArray(data) ? (data as JobAlertRow[]) : [];
    const totalCount = safeCount(rows[0]?.total_count);
    const enabledCount = safeCount(rows[0]?.enabled_count);

    return {
      alerts: rows.map(normalizeJobAlertRow),
      enabledCount,
      error: null,
      page,
      pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
      totalCount,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[job-alerts] list network failure", getErrorText(error));
    }

    return {
      alerts: [],
      enabledCount: 0,
      error: getFriendlyJobAlertError(error),
      page,
      pageCount: 1,
      totalCount: 0,
    };
  }
}

export async function loadCandidateJobAlertsSummary(): Promise<JobAlertsSummary> {
  const result = await loadCandidateJobAlerts(1, 3);

  return {
    enabledCount: result.enabledCount,
    error: result.error,
    recentAlerts: result.alerts.slice(0, 3),
    totalCount: result.totalCount,
  };
}

export async function saveCandidateJobAlert(form: JobAlertForm) {
  const validation = validateJobAlertForm(form);

  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0];
    return { alert: null, error: firstError ?? "Review the alert fields." };
  }

  if (!supabase) {
    return {
      alert: null,
      error: "Supabase is not configured. Please check your environment variables.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("upsert_candidate_job_alert", {
      p_alert_id: form.id ?? null,
      p_alert_name: form.alertName.trim(),
      p_keywords: parseJobAlertKeywords(form.keywordsText),
      p_location: form.location.trim() || null,
      p_employment_type: form.employmentType || null,
      p_work_model: form.workModel || null,
      p_salary_min: form.salaryMin.trim() ? Number(form.salaryMin) : null,
      p_experience_level: form.experienceLevel || null,
      p_enabled: form.enabled,
    });

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[job-alerts] save failed", getErrorText(error));
      }

      return { alert: null, error: getFriendlyJobAlertError(error) };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      alert: row ? normalizeJobAlertRow(row as JobAlertRow) : null,
      error: row ? null : "We could not save this job alert.",
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[job-alerts] save network failure", getErrorText(error));
    }

    return { alert: null, error: getFriendlyJobAlertError(error) };
  }
}

export async function setCandidateJobAlertEnabled(id: string, enabled: boolean) {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
    };
  }

  try {
    const { error } = await supabase.rpc("set_candidate_job_alert_enabled", {
      p_alert_id: id,
      p_enabled: enabled,
    });

    return { error: error ? getFriendlyJobAlertError(error) : null };
  } catch (error) {
    return { error: getFriendlyJobAlertError(error) };
  }
}

export async function setCandidateJobAlertFrequency(
  id: string,
  frequency: JobAlertFrequency,
) {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
    };
  }

  try {
    const { error } = await supabase.rpc("set_candidate_job_alert_frequency", {
      p_alert_id: id,
      p_frequency: frequency,
    });

    return { error: error ? getFriendlyJobAlertError(error) : null };
  } catch (error) {
    return { error: getFriendlyJobAlertError(error) };
  }
}

export async function deleteCandidateJobAlert(id: string) {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
    };
  }

  try {
    const { data, error } = await supabase.rpc("delete_candidate_job_alert", {
      p_alert_id: id,
    });

    if (error) {
      return { error: getFriendlyJobAlertError(error) };
    }

    return data === true
      ? { error: null }
      : { error: "That job alert is no longer available." };
  } catch (error) {
    return { error: getFriendlyJobAlertError(error) };
  }
}

export const jobAlertEmploymentTypes = employmentTypes;
export const jobAlertExperienceLevels = experienceLevels;
export const jobAlertWorkplaceTypes = workplaceTypes;
