export const jobStatuses = [
  "draft",
  "pending",
  "published",
  "closed",
  "archived",
] as const;

export const employmentTypes = [
  "full_time",
  "part_time",
  "contract",
  "temporary",
  "internship",
  "freelance",
] as const;

export const workplaceTypes = ["remote", "hybrid", "on_site"] as const;

export const experienceLevels = [
  "internship",
  "entry",
  "mid",
  "senior",
  "lead",
  "executive",
] as const;

export type JobStatus = (typeof jobStatuses)[number];
export type EmploymentType = (typeof employmentTypes)[number];
export type WorkplaceType = (typeof workplaceTypes)[number];
export type ExperienceLevel = (typeof experienceLevels)[number];

export type Salary = {
  currency: string;
  max: number | null;
  min: number | null;
  visible: boolean;
};

export type Job = {
  applicationEmail: string | null;
  applicationUrl: string | null;
  applicationsCount: number;
  approvedAt: string | null;
  approvedBy: string | null;
  benefits: string;
  category: string;
  companyName: string;
  createdAt: string;
  createdBy: string;
  description: string;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel | null;
  expiresAt: string | null;
  featured: boolean;
  id: string;
  location: string;
  publishedAt: string | null;
  publishAt: string | null;
  rejectionReason: string | null;
  requirements: string;
  salary: Salary;
  slug: string;
  status: JobStatus;
  title: string;
  updatedAt: string;
  viewsCount: number;
  workplaceType: WorkplaceType;
};

export type JobSummary = Pick<
  Job,
  | "applicationsCount"
  | "category"
  | "companyName"
  | "createdAt"
  | "employmentType"
  | "expiresAt"
  | "featured"
  | "id"
  | "location"
  | "publishedAt"
  | "salary"
  | "slug"
  | "status"
  | "title"
  | "viewsCount"
  | "workplaceType"
>;

export type JobCreateInput = {
  applicationEmail?: string | null;
  applicationUrl?: string | null;
  benefits?: string;
  category: string;
  companyName: string;
  description: string;
  employmentType: EmploymentType;
  experienceLevel?: ExperienceLevel | null;
  expiresAt?: string | null;
  location: string;
  publishAt?: string | null;
  requirements?: string;
  salary?: Partial<Salary>;
  slug?: string | null;
  status?: Extract<JobStatus, "draft" | "published">;
  title: string;
  workplaceType: WorkplaceType;
};

export type JobUpdateInput = Partial<
  Omit<
    JobCreateInput,
    "status"
  > & {
    status: JobStatus;
  }
>;

export type JobStatusDisplay = {
  description: string;
  label: string;
  tone: "neutral" | "accent" | "strong";
};

export type JobValidationField =
  | "applicationEmail"
  | "applicationUrl"
  | "applicationMethod"
  | "category"
  | "companyName"
  | "description"
  | "employmentType"
  | "expiresAt"
  | "location"
  | "salary"
  | "title"
  | "workplaceType";

export type JobValidationError = {
  field: JobValidationField;
  message: string;
};

export type JobValidationResult = {
  errors: JobValidationError[];
  valid: boolean;
};

type JobValidationInput = Partial<
  Omit<JobCreateInput, "status"> & {
    status: JobStatus;
  }
>;

const jobStatusDisplays: Record<JobStatus, JobStatusDisplay> = {
  archived: {
    description: "Hidden from normal recruiter workflows.",
    label: "Archived",
    tone: "neutral",
  },
  closed: {
    description: "No longer accepting candidates.",
    label: "Closed",
    tone: "neutral",
  },
  draft: {
    description: "Saved privately by the recruiter.",
    label: "Draft",
    tone: "neutral",
  },
  pending: {
    description: "Legacy submission retained for compatibility.",
    label: "Pending",
    tone: "accent",
  },
  published: {
    description: "Visible to candidates.",
    label: "Published",
    tone: "strong",
  },
};

const employmentTypeLabels: Record<EmploymentType, string> = {
  contract: "Contract",
  freelance: "Freelance",
  full_time: "Full-time",
  internship: "Internship",
  part_time: "Part-time",
  temporary: "Temporary",
};

const workplaceTypeLabels: Record<WorkplaceType, string> = {
  hybrid: "Hybrid",
  on_site: "On-site",
  remote: "Remote",
};

const experienceLevelLabels: Record<ExperienceLevel, string> = {
  entry: "Entry",
  executive: "Executive",
  internship: "Internship",
  lead: "Lead",
  mid: "Mid",
  senior: "Senior",
};

function isOneOf<TValue extends readonly string[]>(
  values: TValue,
  value: unknown,
): value is TValue[number] {
  return typeof value === "string" && values.includes(value);
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function randomSlugSuffix() {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    const values = new Uint8Array(2);
    cryptoApi.getRandomValues(values);

    return Array.from(values, (value) => value.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 4);
  }

  return Math.random().toString(16).slice(2, 6).padEnd(4, "0");
}

export function isJobStatus(value: unknown): value is JobStatus {
  return isOneOf(jobStatuses, value);
}

export function isEmploymentType(value: unknown): value is EmploymentType {
  return isOneOf(employmentTypes, value);
}

export function isWorkplaceType(value: unknown): value is WorkplaceType {
  return isOneOf(workplaceTypes, value);
}

export function isExperienceLevel(value: unknown): value is ExperienceLevel {
  return isOneOf(experienceLevels, value);
}

export function getJobStatusDisplay(status: unknown): JobStatusDisplay {
  return jobStatusDisplays[isJobStatus(status) ? status : "draft"];
}

export function formatEmploymentType(value: EmploymentType) {
  return employmentTypeLabels[value];
}

export function formatWorkplaceType(value: WorkplaceType) {
  return workplaceTypeLabels[value];
}

export function formatExperienceLevel(value: ExperienceLevel | null) {
  return value ? experienceLevelLabels[value] : "Not specified";
}

export function slugifyJobText(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createJobSlugCandidate({
  location,
  title,
}: {
  location?: string | null;
  title: string;
}) {
  const baseSlug = slugifyJobText([title, location].filter(Boolean).join("-"));
  const safeBaseSlug = baseSlug || "job";

  return `${safeBaseSlug.slice(0, 150)}-${randomSlugSuffix()}`;
}

export function formatSalary(salary: Salary) {
  if (!salary.visible) {
    return "Salary hidden";
  }

  const currency = salary.currency.toUpperCase();

  if (salary.min !== null && salary.max !== null) {
    return `${currency} ${salary.min.toLocaleString()} - ${salary.max.toLocaleString()}`;
  }

  if (salary.min !== null) {
    return `From ${currency} ${salary.min.toLocaleString()}`;
  }

  if (salary.max !== null) {
    return `Up to ${currency} ${salary.max.toLocaleString()}`;
  }

  return "Salary not specified";
}

function hasValidApplicationMethod(input: {
  applicationEmail?: string | null;
  applicationUrl?: string | null;
}) {
  return Boolean(input.applicationEmail?.trim() || input.applicationUrl?.trim());
}

function validateSharedJobFields(
  input: JobValidationInput,
  requireCompleteFields: boolean,
) {
  const errors: JobValidationError[] = [];
  const status = input.status ?? "draft";

  if (requireCompleteFields || input.title !== undefined) {
    const title = input.title?.trim() ?? "";

    if (title.length < 4 || title.length > 140) {
      errors.push({
        field: "title",
        message: "Job title must be between 4 and 140 characters.",
      });
    }
  }

  if (requireCompleteFields || input.companyName !== undefined) {
    const companyName = input.companyName?.trim() ?? "";

    if (companyName.length < 2 || companyName.length > 140) {
      errors.push({
        field: "companyName",
        message: "Company name must be between 2 and 140 characters.",
      });
    }
  }

  if (requireCompleteFields || input.location !== undefined) {
    const location = input.location?.trim() ?? "";

    if (location.length < 2 || location.length > 140) {
      errors.push({
        field: "location",
        message: "Location must be between 2 and 140 characters.",
      });
    }
  }

  if (
    input.employmentType !== undefined &&
    !isEmploymentType(input.employmentType)
  ) {
    errors.push({
      field: "employmentType",
      message: "Choose a valid employment type.",
    });
  }

  if (
    input.workplaceType !== undefined &&
    !isWorkplaceType(input.workplaceType)
  ) {
    errors.push({
      field: "workplaceType",
      message: "Choose a valid workplace type.",
    });
  }

  if (requireCompleteFields || input.category !== undefined) {
    const category = input.category?.trim() ?? "";

    if (category.length < 2 || category.length > 120) {
      errors.push({
        field: "category",
        message: "Category must be between 2 and 120 characters.",
      });
    }
  }

  if (requireCompleteFields || input.description !== undefined) {
    const description = input.description?.trim() ?? "";

    if (description.length < 80) {
      errors.push({
        field: "description",
        message: "Description must be at least 80 characters.",
      });
    }
  }

  const salary = input.salary;

  if (salary) {
    const salaryMin = salary.min ?? null;
    const salaryMax = salary.max ?? null;

    if (
      (salaryMin !== null && salaryMin < 0) ||
      (salaryMax !== null && salaryMax < 0) ||
      (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin)
    ) {
      errors.push({
        field: "salary",
        message: "Enter a valid salary range.",
      });
    }
  }

  if (input.expiresAt) {
    const expiresAt = Date.parse(input.expiresAt);

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      errors.push({
        field: "expiresAt",
        message: "Expiry date must be in the future.",
      });
    }
  }

  if (
    status !== "draft" &&
    (requireCompleteFields ||
      input.applicationEmail !== undefined ||
      input.applicationUrl !== undefined) &&
    !hasValidApplicationMethod(input)
  ) {
    errors.push({
      field: "applicationMethod",
      message: "Add an application URL or application email.",
    });
  }

  return errors;
}

export function validateJobCreateInput(
  input: JobCreateInput,
): JobValidationResult {
  const errors = validateSharedJobFields(input, true);

  return {
    errors,
    valid: errors.length === 0,
  };
}

export function validateJobUpdateInput(
  input: JobUpdateInput,
): JobValidationResult {
  const errors = validateSharedJobFields(input, false);

  return {
    errors,
    valid: errors.length === 0,
  };
}
