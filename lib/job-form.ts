import {
  employmentTypes,
  experienceLevels,
  type EmploymentType,
  type ExperienceLevel,
  formatEmploymentType,
  formatExperienceLevel,
  formatSalary,
  formatWorkplaceType,
  type JobStatus,
  type Salary,
  type WorkplaceType,
  workplaceTypes,
} from "@/lib/jobs";
import { isValidEmail } from "@/lib/auth-errors";
import { safeHttpUrl } from "@/lib/input-safety";

export type JobForm = {
  applicationEmail: string;
  applicationUrl: string;
  benefits: string;
  category: string;
  city: string;
  companyName: string;
  country: string;
  description: string;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel | "";
  publishAt: string;
  remote: boolean;
  requirements: string;
  salaryCurrency: string;
  salaryMax: string;
  salaryMin: string;
  salaryVisible: boolean;
  state: string;
  title: string;
  workplaceType: WorkplaceType;
};

export type JobFormField = keyof JobForm;
export type JobValidationField = JobFormField | "applicationMethod" | "salary";
export type JobValidationErrors = Partial<Record<JobValidationField, string>>;

export type JobValidation = {
  errors: JobValidationErrors;
  valid: boolean;
};

export type JobDraft = {
  form: JobForm;
  id: string | null;
  savedAt: string | null;
};

export type JobSubmitMode = Extract<JobStatus, "draft" | "published">;

export type JobSubmitPayload = {
  application_email: string | null;
  application_url: string | null;
  benefits: string;
  category: string;
  company_id?: string | null;
  company_name: string;
  created_by: string;
  description: string;
  employment_type: EmploymentType;
  experience_level: ExperienceLevel | null;
  featured: boolean;
  location: string;
  publish_at: string | null;
  requirements: string;
  salary_currency: string;
  salary_max: number | null;
  salary_min: number | null;
  salary_visible: boolean;
  status: JobSubmitMode;
  title: string;
  workplace_type: WorkplaceType;
};

export type JobPreviewMetaItem = {
  label: string;
  value: string;
};

export type JobPreviewApplicationMethod = {
  label: string;
  value: string;
};

export type JobPreviewData = {
  applicationMethods: JobPreviewApplicationMethod[];
  benefits: string;
  companyName: string;
  description: string;
  meta: JobPreviewMetaItem[];
  requirements: string;
  title: string;
};

export const initialJobForm: JobForm = {
  applicationEmail: "",
  applicationUrl: "",
  benefits: "",
  category: "",
  city: "",
  companyName: "",
  country: "",
  description: "",
  employmentType: "full_time",
  experienceLevel: "",
  publishAt: "",
  remote: false,
  requirements: "",
  salaryCurrency: "USD",
  salaryMax: "",
  salaryMin: "",
  salaryVisible: true,
  state: "",
  title: "",
  workplaceType: "on_site",
};

export const jobEmploymentOptions = employmentTypes;
export const jobWorkplaceOptions = workplaceTypes;
export const jobExperienceOptions = experienceLevels;

export const jobCurrencyOptions = ["USD", "INR", "EUR", "GBP", "CAD", "AUD"];

export const jobFieldLabels: Record<JobValidationField, string> = {
  applicationEmail: "Application Email",
  applicationMethod: "Application Method",
  applicationUrl: "Application URL",
  benefits: "Benefits",
  category: "Category",
  city: "City",
  companyName: "Company Name",
  country: "Country",
  description: "Job Description",
  employmentType: "Employment Type",
  experienceLevel: "Experience Level",
  publishAt: "Publish At",
  remote: "Remote",
  requirements: "Requirements",
  salary: "Salary",
  salaryCurrency: "Currency",
  salaryMax: "Maximum Salary",
  salaryMin: "Minimum Salary",
  salaryVisible: "Salary Visibility",
  state: "State",
  title: "Job Title",
  workplaceType: "Workplace Type",
};

const maxRichTextLength = 12000;
const maxShortTextLength = 140;
const emailError = "Enter a valid application email.";
const urlError = "Enter a valid application URL starting with http:// or https://.";

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeMultilineText(value: string) {
  return value.trim().replace(/\r\n/g, "\n");
}

function isValidHttpUrl(value: string) {
  return safeHttpUrl(value) !== null;
}

function parseOptionalSalary(value: string) {
  const normalizedValue = value.trim().replace(/,/g, "");

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
}

function parsePublishAt(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedDate = new Date(normalizedValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function requireLength({
  errors,
  field,
  max,
  message,
  min,
  value,
}: {
  errors: JobValidationErrors;
  field: JobValidationField;
  max: number;
  message: string;
  min: number;
  value: string;
}) {
  const length = normalizeText(value).length;

  if (length < min || length > max) {
    errors[field] = message;
  }
}

function validateOptionalLength({
  errors,
  field,
  max,
  value,
}: {
  errors: JobValidationErrors;
  field: JobValidationField;
  max: number;
  value: string;
}) {
  if (normalizeMultilineText(value).length > max) {
    errors[field] = `${jobFieldLabels[field]} must be ${max.toLocaleString()} characters or fewer.`;
  }
}

export function buildJobLocation(form: JobForm) {
  const parts = [form.city, form.state, form.country]
    .map(normalizeText)
    .filter(Boolean);

  if (parts.length > 0) {
    return parts.join(", ");
  }

  return form.remote || form.workplaceType === "remote" ? "Remote" : "";
}

export function validateJobForm(
  form: JobForm,
  mode: JobSubmitMode,
): JobValidation {
  const errors: JobValidationErrors = {};
  const applicationEmail = normalizeText(form.applicationEmail);
  const applicationUrl = normalizeText(form.applicationUrl);
  const publishAt = parsePublishAt(form.publishAt);
  const salaryMin = parseOptionalSalary(form.salaryMin);
  const salaryMax = parseOptionalSalary(form.salaryMax);

  if (mode === "published") {
    requireLength({
      errors,
      field: "title",
      max: 140,
      message: "Job title must be between 4 and 140 characters.",
      min: 4,
      value: form.title,
    });
    requireLength({
      errors,
      field: "companyName",
      max: 140,
      message: "Company name must be between 2 and 140 characters.",
      min: 2,
      value: form.companyName,
    });
    requireLength({
      errors,
      field: "category",
      max: 120,
      message: "Category must be between 2 and 120 characters.",
      min: 2,
      value: form.category,
    });

    if (buildJobLocation(form).length < 2) {
      errors.city = "Add a city, country, or choose remote.";
    }

    if (normalizeMultilineText(form.description).length < 80) {
      errors.description = "Description must be at least 80 characters.";
    }

    if (!applicationEmail && !applicationUrl) {
      errors.applicationMethod = "Add an application email or application URL.";
    }
  }

  validateOptionalLength({
    errors,
    field: "requirements",
    max: maxRichTextLength,
    value: form.requirements,
  });
  validateOptionalLength({
    errors,
    field: "benefits",
    max: maxRichTextLength,
    value: form.benefits,
  });

  if (normalizeMultilineText(form.description).length > maxRichTextLength) {
    errors.description = `Job Description must be ${maxRichTextLength.toLocaleString()} characters or fewer.`;
  }

  if (normalizeText(form.title).length > maxShortTextLength) {
    errors.title = "Job title must be 140 characters or fewer.";
  }

  if (normalizeText(form.companyName).length > maxShortTextLength) {
    errors.companyName = "Company name must be 140 characters or fewer.";
  }

  if (applicationEmail && !isValidEmail(applicationEmail)) {
    errors.applicationEmail = emailError;
  }

  if (applicationUrl && !isValidHttpUrl(applicationUrl)) {
    errors.applicationUrl = urlError;
  }

  if (form.publishAt.trim()) {
    if (!publishAt) {
      errors.publishAt = "Choose a valid publish date and time.";
    } else if (publishAt.getTime() <= Date.now()) {
      errors.publishAt = "Publish time must be in the future.";
    }
  }

  if (
    (salaryMin !== null && (!Number.isFinite(salaryMin) || salaryMin < 0)) ||
    (salaryMax !== null && (!Number.isFinite(salaryMax) || salaryMax < 0))
  ) {
    errors.salary = "Enter a valid salary amount.";
  } else if (
    salaryMin !== null &&
    salaryMax !== null &&
    salaryMax < salaryMin
  ) {
    errors.salary = "Maximum salary must be greater than minimum salary.";
  }

  if (!/^[A-Za-z]{3}$/.test(form.salaryCurrency.trim())) {
    errors.salaryCurrency = "Use a valid 3-letter currency code.";
  }

  return {
    errors,
    valid: Object.keys(errors).length === 0,
  };
}

function safeDraftText(value: string, fallback: string, min: number, max: number) {
  const normalizedValue = normalizeText(value);
  const safeValue = normalizedValue || fallback;

  if (safeValue.length >= min) {
    return safeValue.slice(0, max);
  }

  return `${safeValue} draft`.slice(0, max);
}

function safeDraftDescription(form: JobForm, title: string, companyName: string) {
  const description = normalizeMultilineText(form.description);

  if (description.length >= 80) {
    return description.slice(0, maxRichTextLength);
  }

  return [
    description,
    `Draft placeholder for ${title} at ${companyName}. Complete this job description before publishing it.`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, maxRichTextLength);
}

function buildSalaryNumber(value: string) {
  const parsedValue = parseOptionalSalary(value);

  return parsedValue === null || !Number.isFinite(parsedValue)
    ? null
    : parsedValue;
}

function buildPublishAtIso(value: string) {
  const publishAt = parsePublishAt(value);

  return publishAt ? publishAt.toISOString() : null;
}

function buildPreviewSalary(form: JobForm) {
  const salary: Salary = {
    currency: form.salaryCurrency.trim().toUpperCase() || "USD",
    max: buildSalaryNumber(form.salaryMax),
    min: buildSalaryNumber(form.salaryMin),
    visible: form.salaryVisible,
  };

  if (!salary.visible) {
    return formatSalary(salary);
  }

  if (salary.min === null && salary.max === null) {
    return null;
  }

  return formatSalary(salary);
}

export function buildJobPreviewData(form: JobForm): JobPreviewData {
  const location = buildJobLocation(form);
  const salary = buildPreviewSalary(form);
  const category = normalizeText(form.category);
  const experienceLevel = form.experienceLevel
    ? formatExperienceLevel(form.experienceLevel)
    : "";
  const applicationEmail = normalizeText(form.applicationEmail);
  const applicationUrl = normalizeText(form.applicationUrl);

  return {
    applicationMethods: [
      applicationEmail
        ? {
            label: "Email",
            value: applicationEmail,
          }
        : null,
      applicationUrl
        ? {
            label: "URL",
            value: applicationUrl,
          }
        : null,
    ].filter((method): method is JobPreviewApplicationMethod =>
      Boolean(method),
    ),
    benefits: normalizeMultilineText(form.benefits),
    companyName: normalizeText(form.companyName) || "Company name",
    description: normalizeMultilineText(form.description),
    meta: [
      location ? { label: "Location", value: location } : null,
      {
        label: "Employment",
        value: formatEmploymentType(form.employmentType),
      },
      {
        label: "Workplace",
        value: formatWorkplaceType(form.remote ? "remote" : form.workplaceType),
      },
      salary ? { label: "Salary", value: salary } : null,
      experienceLevel
        ? { label: "Experience", value: experienceLevel }
        : null,
      category ? { label: "Category", value: category } : null,
    ].filter((item): item is JobPreviewMetaItem => Boolean(item)),
    requirements: normalizeMultilineText(form.requirements),
    title: normalizeText(form.title) || "Untitled role",
  };
}

export function buildJobSubmitPayload({
  companyId,
  form,
  recruiterId,
  status,
}: {
  companyId?: string | null;
  form: JobForm;
  recruiterId: string;
  status: JobSubmitMode;
}): JobSubmitPayload {
  const isDraft = status === "draft";
  const title = isDraft
    ? safeDraftText(form.title, "Untitled draft", 4, 140)
    : normalizeText(form.title).slice(0, 140);
  const companyName = isDraft
    ? safeDraftText(form.companyName, "Company", 2, 140)
    : normalizeText(form.companyName).slice(0, 140);
  const category = isDraft
    ? safeDraftText(form.category, "General", 2, 120)
    : normalizeText(form.category).slice(0, 120);
  const location = safeDraftText(buildJobLocation(form), "Remote", 2, 140);
  const description = isDraft
    ? safeDraftDescription(form, title, companyName)
    : normalizeMultilineText(form.description).slice(0, maxRichTextLength);

  return {
    application_email: normalizeText(form.applicationEmail) || null,
    application_url: normalizeText(form.applicationUrl) || null,
    benefits: normalizeMultilineText(form.benefits),
    category,
    ...(companyId ? { company_id: companyId } : {}),
    company_name: companyName,
    created_by: recruiterId,
    description,
    employment_type: form.employmentType,
    experience_level: form.experienceLevel || null,
    featured: false,
    location,
    publish_at: buildPublishAtIso(form.publishAt),
    requirements: normalizeMultilineText(form.requirements),
    salary_currency: form.salaryCurrency.trim().toUpperCase() || "USD",
    salary_max: buildSalaryNumber(form.salaryMax),
    salary_min: buildSalaryNumber(form.salaryMin),
    salary_visible: form.salaryVisible,
    status,
    title,
    workplace_type: form.remote ? "remote" : form.workplaceType,
  };
}
