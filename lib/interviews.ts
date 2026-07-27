import { safeHttpsUrl } from "@/lib/input-safety";

export const interviewTypes = ["video", "phone", "on_site"] as const;
export const interviewStatuses = [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
] as const;
export const interviewViews = ["upcoming", "past", "cancelled", "all"] as const;
export const interviewSorts = ["soonest", "latest", "updated"] as const;

export type InterviewType = (typeof interviewTypes)[number];
export type InterviewStatus = (typeof interviewStatuses)[number];
export type InterviewView = (typeof interviewViews)[number];
export type InterviewSort = (typeof interviewSorts)[number];

export type Interview = {
  applicationId: string;
  applicationStatus: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  candidateAvatarUrl: string | null;
  candidateEmail: string;
  candidateId: string;
  candidateInstructions: string;
  candidateLocation: string;
  candidateName: string;
  companyName: string;
  createdAt: string;
  id: string;
  interviewType: InterviewType;
  jobId: string;
  jobSlug: string;
  jobTitle: string;
  location: string | null;
  meetingLink: string | null;
  phoneNumber: string | null;
  recruiterNotes: string;
  scheduledEnd: string;
  scheduledStart: string;
  status: InterviewStatus;
  timezone: string;
  updatedAt: string;
};

export type CandidateInterview = Pick<
  Interview,
  | "applicationId"
  | "candidateInstructions"
  | "id"
  | "interviewType"
  | "location"
  | "meetingLink"
  | "phoneNumber"
  | "scheduledEnd"
  | "scheduledStart"
  | "status"
  | "timezone"
  | "updatedAt"
>;

export type InterviewApplicationOption = {
  applicationId: string;
  applicationStatus: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
};

export type InterviewEvent = {
  actorName: string;
  createdAt: string;
  eventType: string;
  id: string;
  note: string | null;
  newScheduledEnd: string | null;
  newScheduledStart: string | null;
  newStatus: InterviewStatus | null;
  previousScheduledEnd: string | null;
  previousScheduledStart: string | null;
  previousStatus: InterviewStatus | null;
};

export type InterviewFormValues = {
  candidateInstructions: string;
  date: string;
  endTime: string;
  interviewType: InterviewType;
  location: string;
  meetingLink: string;
  phoneNumber: string;
  recruiterNotes: string;
  startTime: string;
  timezone: string;
};

export type InterviewValidationErrors = Partial<
  Record<keyof InterviewFormValues, string>
>;

export type InterviewRow = {
  application_id?: string | null;
  application_status?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  candidate_avatar_url?: string | null;
  candidate_email?: string | null;
  candidate_id?: string | null;
  candidate_instructions?: string | null;
  candidate_location?: string | null;
  candidate_full_name?: string | null;
  company_name?: string | null;
  created_at?: string | null;
  id?: string | null;
  interview_type?: string | null;
  job_id?: string | null;
  job_slug?: string | null;
  job_title?: string | null;
  location?: string | null;
  meeting_link?: string | null;
  phone_number?: string | null;
  recruiter_notes?: string | null;
  scheduled_end?: string | null;
  scheduled_start?: string | null;
  status?: string | null;
  timezone?: string | null;
  total_count?: number | null;
  updated_at?: string | null;
};

export type InterviewEventRow = {
  actor_name?: string | null;
  created_at?: string | null;
  event_type?: string | null;
  id?: string | null;
  new_scheduled_end?: string | null;
  new_scheduled_start?: string | null;
  new_status?: string | null;
  note?: string | null;
  previous_scheduled_end?: string | null;
  previous_scheduled_start?: string | null;
  previous_status?: string | null;
};

export type CandidateInterviewRow = {
  application_id?: string | null;
  candidate_instructions?: string | null;
  id?: string | null;
  interview_type?: string | null;
  location?: string | null;
  meeting_link?: string | null;
  phone_number?: string | null;
  scheduled_end?: string | null;
  scheduled_start?: string | null;
  status?: string | null;
  timezone?: string | null;
  updated_at?: string | null;
};

export const interviewTypeLabels: Record<InterviewType, string> = {
  on_site: "On-site",
  phone: "Phone",
  video: "Video / Online",
};

export const interviewStatusLabels: Record<InterviewStatus, string> = {
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No show",
  scheduled: "Scheduled",
};

export function isInterviewType(value: string | null | undefined): value is InterviewType {
  return interviewTypes.includes(value as InterviewType);
}

export function isInterviewStatus(
  value: string | null | undefined,
): value is InterviewStatus {
  return interviewStatuses.includes(value as InterviewStatus);
}

export function getInterviewTypeLabel(value: string | null | undefined) {
  return isInterviewType(value) ? interviewTypeLabels[value] : "Interview";
}

export function getInterviewStatusLabel(value: string | null | undefined) {
  return isInterviewStatus(value) ? interviewStatusLabels[value] : "Unknown";
}

export function getDefaultInterviewTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function normalizeText(value: string | null | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function getTimezoneParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(value);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
}

export function localDateTimeToIso(
  date: string,
  time: string,
  timezone: string,
) {
  const localAsUtc = new Date(`${date}T${time}:00.000Z`);

  if (Number.isNaN(localAsUtc.getTime())) {
    return null;
  }

  try {
    const firstParts = getTimezoneParts(localAsUtc, timezone);
    const firstOffset =
      Date.UTC(
        firstParts.year,
        firstParts.month - 1,
        firstParts.day,
        firstParts.hour,
        firstParts.minute,
        firstParts.second,
      ) - localAsUtc.getTime();
    const firstGuess = new Date(localAsUtc.getTime() - firstOffset);
    const secondParts = getTimezoneParts(firstGuess, timezone);
    const secondOffset =
      Date.UTC(
        secondParts.year,
        secondParts.month - 1,
        secondParts.day,
        secondParts.hour,
        secondParts.minute,
        secondParts.second,
      ) - firstGuess.getTime();

    return new Date(localAsUtc.getTime() - secondOffset).toISOString();
  } catch {
    return null;
  }
}

export function isoToLocalDateTime(value: string, timezone: string) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return { date: "", time: "" };
    }

    const parts = getTimezoneParts(date, timezone);
    return {
      date: [parts.year, String(parts.month).padStart(2, "0"), String(parts.day).padStart(2, "0")].join("-"),
      time: [String(parts.hour).padStart(2, "0"), String(parts.minute).padStart(2, "0")].join(":"),
    };
  } catch {
    return { date: "", time: "" };
  }
}

export function mapInterviewRow(row: InterviewRow): Interview | null {
  if (
    !row.id ||
    !row.application_id ||
    !row.candidate_id ||
    !row.job_id ||
    !row.scheduled_start ||
    !row.scheduled_end ||
    !isInterviewType(row.interview_type) ||
    !isInterviewStatus(row.status)
  ) {
    return null;
  }

  return {
    applicationId: row.application_id,
    applicationStatus: normalizeText(row.application_status, "applied"),
    cancelledAt: row.cancelled_at ?? null,
    cancellationReason: row.cancellation_reason?.trim() || null,
    candidateAvatarUrl: row.candidate_avatar_url?.trim() || null,
    candidateEmail: normalizeText(row.candidate_email, "Email unavailable"),
    candidateId: row.candidate_id,
    candidateInstructions: row.candidate_instructions?.trim() ?? "",
    candidateLocation: normalizeText(row.candidate_location, "Location unavailable"),
    candidateName: normalizeText(row.candidate_full_name, "Unknown Candidate"),
    companyName: normalizeText(row.company_name, "Company"),
    createdAt: row.created_at ?? row.scheduled_start,
    id: row.id,
    interviewType: row.interview_type,
    jobId: row.job_id,
    jobSlug: normalizeText(row.job_slug),
    jobTitle: normalizeText(row.job_title, "Untitled role"),
    location: row.location?.trim() || null,
    meetingLink: safeHttpsUrl(row.meeting_link),
    phoneNumber: row.phone_number?.trim() || null,
    recruiterNotes: row.recruiter_notes?.trim() ?? "",
    scheduledEnd: row.scheduled_end,
    scheduledStart: row.scheduled_start,
    status: row.status,
    timezone: normalizeText(row.timezone, "UTC"),
    updatedAt: row.updated_at ?? row.created_at ?? row.scheduled_start,
  };
}

export function mapInterviewEventRow(row: InterviewEventRow): InterviewEvent | null {
  if (!row.id || !row.created_at || !row.event_type) {
    return null;
  }

  return {
    actorName: normalizeText(row.actor_name, "System"),
    createdAt: row.created_at,
    eventType: row.event_type,
    id: row.id,
    newScheduledEnd: row.new_scheduled_end ?? null,
    newScheduledStart: row.new_scheduled_start ?? null,
    newStatus: isInterviewStatus(row.new_status) ? row.new_status : null,
    note: row.note?.trim() || null,
    previousScheduledEnd: row.previous_scheduled_end ?? null,
    previousScheduledStart: row.previous_scheduled_start ?? null,
    previousStatus: isInterviewStatus(row.previous_status)
      ? row.previous_status
      : null,
  };
}

export function mapCandidateInterviewRow(
  row: CandidateInterviewRow,
): CandidateInterview | null {
  if (
    !row.id ||
    !row.application_id ||
    !row.scheduled_start ||
    !row.scheduled_end ||
    !isInterviewType(row.interview_type) ||
    !isInterviewStatus(row.status)
  ) {
    return null;
  }

  return {
    applicationId: row.application_id,
    candidateInstructions: row.candidate_instructions?.trim() ?? "",
    id: row.id,
    interviewType: row.interview_type,
    location: row.location?.trim() || null,
    meetingLink: safeHttpsUrl(row.meeting_link),
    phoneNumber: row.phone_number?.trim() || null,
    scheduledEnd: row.scheduled_end,
    scheduledStart: row.scheduled_start,
    status: row.status,
    timezone: normalizeText(row.timezone, "UTC"),
    updatedAt: row.updated_at ?? row.scheduled_start,
  };
}

export function validateInterviewForm(
  values: InterviewFormValues,
  now = new Date(),
): { errors: InterviewValidationErrors; endIso: string | null; startIso: string | null } {
  const errors: InterviewValidationErrors = {};
  const timezone = values.timezone.trim();
  const startIso = localDateTimeToIso(values.date, values.startTime, timezone);
  const endIso = localDateTimeToIso(values.date, values.endTime, timezone);

  if (!values.date) errors.date = "Choose an interview date.";
  if (!values.startTime) errors.startTime = "Choose a start time.";
  if (!values.endTime) errors.endTime = "Choose an end time.";
  if (!timezone || timezone.length > 64) errors.timezone = "Enter a valid timezone.";
  if (!startIso || !endIso) {
    errors.date ??= "Choose a valid date and time.";
  } else {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (end <= start) errors.endTime = "End time must be after the start time.";
    if (start <= now) errors.date = "Interview time must be in the future.";
    if (end.getTime() - start.getTime() > 24 * 60 * 60 * 1000) {
      errors.endTime = "Interview duration cannot exceed 24 hours.";
    }
  }

  if (!isInterviewType(values.interviewType)) {
    errors.interviewType = "Choose an interview type.";
  }

  if (values.interviewType === "video") {
    if (values.meetingLink.trim().length > 500) {
      errors.meetingLink = "Meeting links must be 500 characters or fewer.";
    }

    try {
      const url = new URL(values.meetingLink.trim());
      if (url.protocol !== "https:") throw new Error("unsafe");
    } catch {
      errors.meetingLink = "Use a valid HTTPS meeting link.";
    }
  }

  if (values.interviewType === "phone" && values.phoneNumber.replace(/\D/g, "").length < 7) {
    errors.phoneNumber = "Enter a valid phone number.";
  }

  if (values.phoneNumber.trim().length > 32) {
    errors.phoneNumber = "Phone numbers must be 32 characters or fewer.";
  }

  if (values.interviewType === "on_site" && values.location.trim().length < 3) {
    errors.location = "Enter the interview location.";
  }

  if (values.location.trim().length > 240) {
    errors.location = "Locations must be 240 characters or fewer.";
  }

  if (values.candidateInstructions.trim().length > 4000) {
    errors.candidateInstructions = "Candidate instructions must be 4,000 characters or fewer.";
  }
  if (values.recruiterNotes.trim().length > 12000) {
    errors.recruiterNotes = "Recruiter notes must be 12,000 characters or fewer.";
  }

  return { errors, endIso, startIso };
}

export function formatInterviewDateTime(value: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return "Date unavailable";
  }
}

export function formatInterviewTimeRange(
  start: string,
  end: string,
  timezone: string,
) {
  return `${formatInterviewDateTime(start, timezone)} - ${new Intl.DateTimeFormat("en", {
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(end))}`;
}
