export const applicationStatuses = [
  "applied",
  "reviewing",
  "shortlisted",
  "interview",
  "offered",
  "hired",
  "rejected",
  "withdrawn",
] as const;

export const applicationResumeBucket = "application-resumes";
export const applicationResumeMaxSizeBytes = 5 * 1024 * 1024;
export const applicationResumeMaxSizeLabel = "5 MB";

export type ApplicationStatus = (typeof applicationStatuses)[number];
export type RecruiterApplicationStatus = Exclude<
  ApplicationStatus,
  "withdrawn"
>;

export const recruiterApplicationTagValues = [
  "strong_fit",
  "needs_review",
  "referral",
  "senior_candidate",
  "follow_up",
] as const;

export type RecruiterApplicationTag =
  (typeof recruiterApplicationTagValues)[number];
export type ApplicationStatusActorRole =
  | "job_seeker"
  | "recruiter"
  | "system";

export type ApplicationStatusHistoryItem = {
  applicationId: string;
  changedByDisplay: string;
  changedByRole: ApplicationStatusActorRole;
  createdAt: string;
  id: string;
  newStatus: ApplicationStatus;
  note: string | null;
  previousStatus: ApplicationStatus | null;
};

export type ApplicationStatusHistoryRow = {
  application_id?: string | null;
  changed_by_display?: string | null;
  changed_by_role?: string | null;
  created_at?: string | null;
  id?: string | null;
  new_status?: string | null;
  note?: string | null;
  previous_status?: string | null;
};

export type ApplicationRecruiterNote = {
  applicationId: string;
  createdAt: string;
  id: string;
  note: string;
  recruiterId: string;
  updatedAt: string;
};

export type ApplicationStatusTransitionRow = {
  history_created_at?: string | null;
  history_id?: string | null;
  id?: string | null;
  notification_created?: boolean | null;
  previous_status?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

export type ApplicationStatusDisplay = {
  className: string;
  description: string;
  iconClassName: string;
  label: string;
};

export type ApplicationAnswerValue =
  | ApplicationAnswerValue[]
  | boolean
  | null
  | number
  | string
  | { [key: string]: ApplicationAnswerValue };

export type ApplicationAnswers = Record<string, ApplicationAnswerValue>;

export type Application = {
  answers: ApplicationAnswers;
  appliedAt: string;
  candidateId: string;
  coverLetter: string;
  hiredAt: string | null;
  id: string;
  interviewAt: string | null;
  jobId: string;
  metadata: ApplicationAnswers;
  notes: string;
  recruiterId: string;
  resumeUrl: string | null;
  reviewedAt: string | null;
  score: number | null;
  source: string | null;
  status: ApplicationStatus;
  updatedAt: string;
  withdrawnAt: string | null;
};

export type ApplicationSummary = Pick<
  Application,
  | "appliedAt"
  | "candidateId"
  | "id"
  | "jobId"
  | "recruiterId"
  | "resumeUrl"
  | "status"
  | "updatedAt"
>;

export type ApplicationCreateInput = {
  answers?: ApplicationAnswers;
  coverLetter?: string;
  jobId: string;
  metadata?: ApplicationAnswers;
  resumeUrl?: string | null;
  source?: string | null;
};

export type ApplicationStatusUpdateInput = {
  applicationId: string;
  expectedStatus: ApplicationStatus;
  status: RecruiterApplicationStatus;
};

export type ApplicationRecruiterNotesUpdateInput = {
  applicationId: string;
  notes: string;
};

export type ApplicationQuestion = {
  id: string;
  label: string;
  required?: boolean;
};

export type CandidateApplicationJob = {
  companyName: string;
  employmentType: string | null;
  location: string;
  slug: string;
  title: string;
};

export type CandidateApplicationSummary = {
  appliedAt: string | null;
  id: string;
  job: CandidateApplicationJob | null;
  status: ApplicationStatus;
  updatedAt: string | null;
};

export type CandidateApplicationJobDetails = CandidateApplicationJob & {
  applicationEmail: string | null;
  applicationUrl: string | null;
  benefits: string;
  category: string;
  description: string;
  experienceLevel: string | null;
  requirements: string;
  salary: {
    currency: string;
    max: number | null;
    min: number | null;
    visible: boolean;
  };
  workplaceType: string | null;
};

export type CandidateApplicationDetails = Omit<
  CandidateApplicationSummary,
  "job"
> & {
  coverLetter: string;
  job: CandidateApplicationJobDetails | null;
  resumeSubmitted: boolean;
};

export type ApplicationResumeValidationResult = {
  error: string | null;
  valid: boolean;
};

const statusClassNames = {
  amber:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-200",
  blue:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-300/25 dark:bg-blue-300/10 dark:text-blue-200",
  green:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-200",
  muted:
    "border-gray-300 bg-gray-100 text-gray-600 dark:border-white/10 dark:bg-white/10 dark:text-gray-400",
  neutral:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-300",
  purple:
    "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-300/25 dark:bg-purple-300/10 dark:text-purple-200",
  red:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-300/25 dark:bg-red-300/10 dark:text-red-200",
  teal:
    "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-300/25 dark:bg-teal-300/10 dark:text-teal-200",
};

const statusIconClassNames = {
  amber: "bg-amber-500 dark:bg-amber-300",
  blue: "bg-blue-500 dark:bg-blue-300",
  green: "bg-emerald-500 dark:bg-emerald-300",
  muted: "bg-gray-500 dark:bg-gray-400",
  neutral: "bg-gray-400 dark:bg-gray-300",
  purple: "bg-purple-500 dark:bg-purple-300",
  red: "bg-red-500 dark:bg-red-300",
  teal: "bg-teal-500 dark:bg-teal-300",
};

export const applicationStatusDisplays: Record<
  ApplicationStatus,
  ApplicationStatusDisplay
> = {
  applied: {
    className: statusClassNames.neutral,
    description: "Application has been submitted.",
    iconClassName: statusIconClassNames.neutral,
    label: "Applied",
  },
  reviewing: {
    className: statusClassNames.amber,
    description: "Application is under review.",
    iconClassName: statusIconClassNames.amber,
    label: "Reviewing",
  },
  shortlisted: {
    className: statusClassNames.purple,
    description: "Candidate has been shortlisted.",
    iconClassName: statusIconClassNames.purple,
    label: "Shortlisted",
  },
  interview: {
    className: statusClassNames.blue,
    description: "Interview stage is active.",
    iconClassName: statusIconClassNames.blue,
    label: "Interview",
  },
  offered: {
    className: statusClassNames.teal,
    description: "Offer stage is active.",
    iconClassName: statusIconClassNames.teal,
    label: "Offered",
  },
  hired: {
    className: statusClassNames.green,
    description: "Candidate was hired.",
    iconClassName: statusIconClassNames.green,
    label: "Hired",
  },
  rejected: {
    className: statusClassNames.red,
    description: "Application will not move forward.",
    iconClassName: statusIconClassNames.red,
    label: "Rejected",
  },
  withdrawn: {
    className: statusClassNames.muted,
    description: "Application was withdrawn.",
    iconClassName: statusIconClassNames.muted,
    label: "Withdrawn",
  },
};

const unknownApplicationStatusDisplay: ApplicationStatusDisplay = {
  className: statusClassNames.neutral,
  description: "This application has an unsupported status.",
  iconClassName: statusIconClassNames.neutral,
  label: "Unknown",
};

export const recruiterApplicationStatusTransitions: Readonly<
  Record<ApplicationStatus, readonly RecruiterApplicationStatus[]>
> = {
  applied: ["reviewing", "shortlisted", "rejected"],
  reviewing: ["shortlisted", "interview", "rejected"],
  shortlisted: ["interview", "offered", "rejected"],
  interview: ["shortlisted", "offered", "rejected"],
  offered: ["hired", "rejected"],
  hired: [],
  rejected: [],
  withdrawn: [],
};

const finalApplicationStatuses: readonly ApplicationStatus[] = [
  "hired",
  "rejected",
  "withdrawn",
];

export function isApplicationStatus(
  status: string | null | undefined,
): status is ApplicationStatus {
  return applicationStatuses.includes(status as ApplicationStatus);
}

export function normalizeApplicationStatus(
  status: string | null | undefined,
): ApplicationStatus {
  if (status === "submitted") {
    return "applied";
  }

  return isApplicationStatus(status) ? status : "applied";
}

export function getApplicationStatusDisplay(
  status: string | null | undefined,
) {
  if (status === "submitted") {
    return applicationStatusDisplays.applied;
  }

  return isApplicationStatus(status)
    ? applicationStatusDisplays[status]
    : unknownApplicationStatusDisplay;
}

export function getRecruiterApplicationNextStatuses(
  status: string | null | undefined,
): readonly RecruiterApplicationStatus[] {
  return isApplicationStatus(status)
    ? recruiterApplicationStatusTransitions[status]
    : [];
}

export function getRecruiterApplicationTagLabel(
  tag: RecruiterApplicationTag,
) {
  const labels: Record<RecruiterApplicationTag, string> = {
    follow_up: "Follow Up",
    needs_review: "Needs Review",
    referral: "Referral",
    senior_candidate: "Senior Candidate",
    strong_fit: "Strong Fit",
  };

  return labels[tag];
}

export function canCandidateWithdrawApplication(
  status: string | null | undefined,
) {
  return (
    isApplicationStatus(status) && !finalApplicationStatuses.includes(status)
  );
}

export function mapApplicationStatusHistoryRow(
  row: ApplicationStatusHistoryRow,
): ApplicationStatusHistoryItem | null {
  if (
    !row.id ||
    !row.application_id ||
    !row.created_at ||
    !isApplicationStatus(row.new_status)
  ) {
    return null;
  }

  const changedByRole: ApplicationStatusActorRole =
    row.changed_by_role === "recruiter" ||
    row.changed_by_role === "job_seeker" ||
    row.changed_by_role === "system"
      ? row.changed_by_role
      : "system";

  return {
    applicationId: row.application_id,
    changedByDisplay: row.changed_by_display?.trim() || "System",
    changedByRole,
    createdAt: row.created_at,
    id: row.id,
    newStatus: row.new_status,
    note: row.note?.trim() || null,
    previousStatus: isApplicationStatus(row.previous_status)
      ? row.previous_status
      : null,
  };
}

function getErrorText(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const candidate = error as { code?: unknown; message?: unknown };
  return `${typeof candidate.code === "string" ? candidate.code : ""} ${
    typeof candidate.message === "string" ? candidate.message : ""
  }`.toLowerCase();
}

export function getApplicationWorkflowErrorMessage(error: unknown) {
  const errorText = getErrorText(error);

  if (errorText.includes("application_status_conflict") || errorText.includes("40001")) {
    return "This application changed in another session. We refreshed the latest status.";
  }

  if (
    errorText.includes("invalid_application_status_transition") ||
    errorText.includes("application_cannot_be_withdrawn") ||
    errorText.includes("22023")
  ) {
    return "That status change is no longer available.";
  }

  if (
    errorText.includes("not_found_or_forbidden") ||
    errorText.includes("required") ||
    errorText.includes("42501") ||
    errorText.includes("28000")
  ) {
    return "You do not have permission to update this application.";
  }

  if (errorText.includes("failed to fetch") || errorText.includes("network")) {
    return "We could not connect. Please check your internet connection and try again.";
  }

  return "We could not update the application. Please try again.";
}

export function validateApplicationResumeFile(
  file: Pick<File, "name" | "size" | "type"> | null,
): ApplicationResumeValidationResult {
  if (!file) {
    return {
      error: "Upload a PDF resume before applying.",
      valid: false,
    };
  }

  const isPdf =
    file.type === "application/pdf" &&
    file.name.trim().toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    return {
      error: "Resume must be a PDF file.",
      valid: false,
    };
  }

  if (file.size > applicationResumeMaxSizeBytes) {
    return {
      error: `Resume must be ${applicationResumeMaxSizeLabel} or smaller.`,
      valid: false,
    };
  }

  if (file.size <= 0) {
    return {
      error: "Resume file appears to be empty.",
      valid: false,
    };
  }

  return {
    error: null,
    valid: true,
  };
}
