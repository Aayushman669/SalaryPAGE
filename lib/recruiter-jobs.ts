import type { RecruiterJobFilter } from "@/lib/recruiter-job-filters";

export const recruiterJobListColumns = [
  "id",
  "title",
  "slug",
  "company_name",
  "employment_type",
  "location",
  "status",
  "moderation_status",
  "publish_at",
  "published_at",
  "expires_at",
  "created_at",
  "updated_at",
  "applications_count",
  "salary_currency",
  "salary_max",
  "salary_min",
  "salary_visible",
  "workplace_type",
].join(", ");

export type RecruiterJobListRow = {
  applications_count?: number | null;
  company_name?: string | null;
  created_at?: string | null;
  employment_type?: string | null;
  expires_at?: string | null;
  id?: string | null;
  location?: string | null;
  moderation_status?: string | null;
  publish_at?: string | null;
  published_at?: string | null;
  salary_currency?: string | null;
  salary_max?: number | string | null;
  salary_min?: number | string | null;
  salary_visible?: boolean | null;
  slug?: string | null;
  status?: string | null;
  title?: string | null;
  updated_at?: string | null;
  workplace_type?: string | null;
};

export type RecruiterJobListStatus =
  | "active"
  | "archived"
  | "closed"
  | "draft"
  | "expired"
  | "pending"
  | "scheduled"
  | "unknown";

export type RecruiterJobListItem = {
  applicationsCount: number;
  companyName: string;
  createdAt: string | null;
  employmentType: string;
  expiresAt: string | null;
  id: string;
  location: string;
  moderationStatus: string;
  publishAt: string | null;
  publishedAt: string | null;
  salary: {
    currency: string;
    max: number | null;
    min: number | null;
    visible: boolean;
  };
  slug: string | null;
  status: RecruiterJobListStatus;
  title: string;
  updatedAt: string | null;
  workplaceType: string;
};

export type RecruiterJobsResponse = {
  data: RecruiterJobListItem[];
  error?: string;
  filter: RecruiterJobFilter;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

function safeText(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : value;
}

function safeCount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function safeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function getRecruiterJobListStatus(
  row: RecruiterJobListRow,
  now = Date.now(),
): RecruiterJobListStatus {
  if (row.status === "published") {
    const publishAt = row.publish_at ? new Date(row.publish_at).getTime() : NaN;
    const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : NaN;

    if (Number.isFinite(expiresAt) && expiresAt <= now) return "expired";
    if (Number.isFinite(publishAt) && publishAt > now) return "scheduled";
    return row.moderation_status === "active" ? "active" : "unknown";
  }

  return row.status === "draft" ||
    row.status === "pending" ||
    row.status === "closed" ||
    row.status === "archived"
    ? row.status
    : "unknown";
}

export function mapRecruiterJobListRow(
  row: RecruiterJobListRow,
): RecruiterJobListItem {
  return {
    applicationsCount: safeCount(row.applications_count),
    companyName: safeText(row.company_name, "Company not specified"),
    createdAt: safeDate(row.created_at),
    employmentType: safeText(row.employment_type, "Employment not specified"),
    expiresAt: safeDate(row.expires_at),
    id: safeText(row.id, "job"),
    location: safeText(row.location, "Location not specified"),
    moderationStatus: safeText(row.moderation_status, "active"),
    publishAt: safeDate(row.publish_at),
    publishedAt: safeDate(row.published_at),
    salary: {
      currency: safeText(row.salary_currency, "USD"),
      max: safeNumber(row.salary_max),
      min: safeNumber(row.salary_min),
      visible: row.salary_visible !== false,
    },
    slug: row.slug?.trim() || null,
    status: getRecruiterJobListStatus(row),
    title: safeText(row.title, "Untitled job"),
    updatedAt: safeDate(row.updated_at),
    workplaceType: safeText(row.workplace_type, "Workplace not specified"),
  };
}
