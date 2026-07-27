import { CONNECTION_ERROR_MESSAGE, isNetworkError, logAuthError } from "@/lib/auth-errors";
import { safeHttpUrl } from "@/lib/input-safety";
import type { ProfileRow } from "@/lib/auth-profiles";
import { supabase } from "@/lib/supabase";
import { validateUploadFileSignature } from "@/lib/upload-validation";

export const recruiterProfileAssetBucket = "candidate-profile-assets";
export const recruiterAvatarMaxBytes = 5 * 1024 * 1024;

export type RecruiterProfileForm = {
  bio: string;
  department: string;
  fullName: string;
  jobTitle: string;
  linkedinUrl: string;
  location: string;
  phone: string;
  recruiterAvatarPath: string | null;
};

export type RecruiterProfileValidationErrors = Partial<
  Record<keyof RecruiterProfileForm | "avatar", string>
>;

export type RecruiterNotificationPreferences = {
  adminMessagesEmail: boolean;
  adminMessagesInApp: boolean;
  candidateStatusUpdatesEmail: boolean;
  candidateStatusUpdatesInApp: boolean;
  interviewCancelledEmail: boolean;
  interviewCancelledInApp: boolean;
  interviewRemindersEmail: boolean;
  interviewRemindersInApp: boolean;
  interviewRescheduledEmail: boolean;
  interviewRescheduledInApp: boolean;
  jobExpiryRemindersEmail: boolean;
  jobExpiryRemindersInApp: boolean;
  newApplicationEmail: boolean;
  newApplicationInApp: boolean;
  productUpdatesEmail: boolean;
};

export type RecruiterDeletionRequest = {
  id: string;
  reason: string | null;
  requestedAt: string;
  status: string;
};

export const defaultRecruiterNotificationPreferences: RecruiterNotificationPreferences = {
  adminMessagesEmail: true,
  adminMessagesInApp: true,
  candidateStatusUpdatesEmail: true,
  candidateStatusUpdatesInApp: true,
  interviewCancelledEmail: true,
  interviewCancelledInApp: true,
  interviewRemindersEmail: true,
  interviewRemindersInApp: true,
  interviewRescheduledEmail: true,
  interviewRescheduledInApp: true,
  jobExpiryRemindersEmail: true,
  jobExpiryRemindersInApp: true,
  newApplicationEmail: true,
  newApplicationInApp: true,
  productUpdatesEmail: true,
};

type RecruiterNotificationRow = Partial<{
  admin_messages_email: boolean | null;
  admin_messages_in_app: boolean | null;
  candidate_status_updates_email: boolean | null;
  candidate_status_updates_in_app: boolean | null;
  interview_cancelled_email: boolean | null;
  interview_cancelled_in_app: boolean | null;
  interview_reminders_email: boolean | null;
  interview_reminders_in_app: boolean | null;
  interview_rescheduled_email: boolean | null;
  interview_rescheduled_in_app: boolean | null;
  job_expiry_reminders_email: boolean | null;
  job_expiry_reminders_in_app: boolean | null;
  new_application_email: boolean | null;
  new_application_in_app: boolean | null;
  product_updates: boolean | null;
  product_updates_email: boolean | null;
}>;

const recruiterNotificationSelect =
  "admin_messages_email, admin_messages_in_app, candidate_status_updates_email, candidate_status_updates_in_app, interview_cancelled_email, interview_cancelled_in_app, interview_reminders_email, interview_reminders_in_app, interview_rescheduled_email, interview_rescheduled_in_app, job_expiry_reminders_email, job_expiry_reminders_in_app, new_application_email, new_application_in_app, product_updates, product_updates_email";

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function isValidHttpUrl(value: string) {
  return safeHttpUrl(value) !== null;
}

export function createRecruiterProfileForm(profile: ProfileRow): RecruiterProfileForm {
  return {
    bio: profile.bio ?? "",
    department: profile.department ?? "",
    fullName: profile.full_name ?? "",
    jobTitle: profile.job_title ?? "",
    linkedinUrl: profile.linkedin_url ?? "",
    location: profile.location ?? "",
    phone: profile.phone ?? "",
    recruiterAvatarPath: profile.recruiter_avatar_path ?? null,
  };
}

export function validateRecruiterProfile(
  form: RecruiterProfileForm,
): { errors: RecruiterProfileValidationErrors; valid: boolean } {
  const errors: RecruiterProfileValidationErrors = {};
  const fullName = clean(form.fullName);

  if (fullName.length < 2 || fullName.length > 120) {
    errors.fullName = "Full name must be between 2 and 120 characters.";
  }

  if (clean(form.jobTitle).length > 160) {
    errors.jobTitle = "Job title must be 160 characters or fewer.";
  }

  if (clean(form.department).length > 160) {
    errors.department = "Department must be 160 characters or fewer.";
  }

  if (clean(form.phone).length > 40) {
    errors.phone = "Phone number must be 40 characters or fewer.";
  }

  if (clean(form.location).length > 160) {
    errors.location = "Location must be 160 characters or fewer.";
  }

  if (clean(form.bio).length > 4000) {
    errors.bio = "Bio must be 4,000 characters or fewer.";
  }

  if (clean(form.linkedinUrl) && !isValidHttpUrl(clean(form.linkedinUrl))) {
    errors.linkedinUrl = "LinkedIn URL must use a valid http or https URL.";
  }

  return { errors, valid: Object.keys(errors).length === 0 };
}

function getFriendlyRecruiterSettingsError(error: unknown) {
  if (isNetworkError(error)) {
    return CONNECTION_ERROR_MESSAGE;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("jwt") || message.includes("authentication")) {
    return "Your session expired. Please sign in again.";
  }

  if (message.includes("recruiter_required") || message.includes("permission")) {
    return "Only your own recruiter settings can be changed.";
  }

  if (message.includes("deletion_request_already_exists") || message.includes("duplicate")) {
    return "An account deletion request is already under review.";
  }

  return "We could not save your recruiter settings. Please try again.";
}

async function getRecruiterIdentity(expectedUserId?: string) {
  if (!supabase) {
    return { error: "Supabase is not configured.", userId: null };
  }

  const { data, error } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;

  if (error || !userId) {
    return { error: "Your session expired. Please sign in again.", userId: null };
  }

  if (expectedUserId && expectedUserId !== userId) {
    return { error: "Only your own recruiter settings can be changed.", userId: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role_mode")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || profile?.role_mode !== "recruiter") {
    return { error: "Only recruiter accounts can use these settings.", userId: null };
  }

  return { error: null, userId };
}

export async function uploadRecruiterAvatar(file: File, userId: string) {
  if (!supabase) {
    return { error: "Supabase is not configured.", path: null };
  }

  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensions[file.type];

  if (!extension || file.size <= 0 || file.size > recruiterAvatarMaxBytes) {
    return {
      error: "Profile photo must be a JPG, PNG, or WebP image smaller than 5MB.",
      path: null,
    };
  }

  const signatureError = await validateUploadFileSignature(file, file.type as
    "image/jpeg" | "image/png" | "image/webp");

  if (signatureError) {
    return { error: signatureError, path: null };
  }

  const identity = await getRecruiterIdentity(userId);
  if (identity.error || !identity.userId) {
    return { error: identity.error, path: null };
  }

  const path = `${identity.userId}/avatar/${globalThis.crypto.randomUUID()}.${extension}`;

  try {
    const { error } = await supabase.storage
      .from(recruiterProfileAssetBucket)
      .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });

    if (error) {
      logAuthError("[recruiter-settings] avatar upload failed", error);
      return { error: "We could not upload your profile photo. Please try again.", path: null };
    }

    return { error: null, path };
  } catch (error) {
    logAuthError("[recruiter-settings] avatar upload network failure", error);
    return { error: CONNECTION_ERROR_MESSAGE, path: null };
  }
}

export async function deleteRecruiterAvatar(path: string | null) {
  if (!supabase || !path) {
    return null;
  }

  const { error } = await supabase.storage
    .from(recruiterProfileAssetBucket)
    .remove([path]);

  if (error) {
    logAuthError("[recruiter-settings] avatar cleanup failed", error);
    return "We saved your profile, but could not remove the previous photo.";
  }

  return null;
}

export async function getRecruiterAvatarUrl(path: string | null) {
  if (!supabase || !path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(recruiterProfileAssetBucket)
    .createSignedUrl(path, 600);

  if (error || !data?.signedUrl) {
    if (error) {
      logAuthError("[recruiter-settings] signed avatar URL failed", error);
    }
    return null;
  }

  return data.signedUrl;
}

export function mapRecruiterNotificationRow(
  row: RecruiterNotificationRow | null,
): RecruiterNotificationPreferences {
  return {
    adminMessagesEmail: row?.admin_messages_email ?? true,
    adminMessagesInApp: row?.admin_messages_in_app ?? true,
    candidateStatusUpdatesEmail: row?.candidate_status_updates_email ?? true,
    candidateStatusUpdatesInApp: row?.candidate_status_updates_in_app ?? true,
    interviewCancelledEmail: row?.interview_cancelled_email ?? true,
    interviewCancelledInApp: row?.interview_cancelled_in_app ?? true,
    interviewRemindersEmail: row?.interview_reminders_email ?? true,
    interviewRemindersInApp: row?.interview_reminders_in_app ?? true,
    interviewRescheduledEmail: row?.interview_rescheduled_email ?? true,
    interviewRescheduledInApp: row?.interview_rescheduled_in_app ?? true,
    jobExpiryRemindersEmail: row?.job_expiry_reminders_email ?? true,
    jobExpiryRemindersInApp: row?.job_expiry_reminders_in_app ?? true,
    newApplicationEmail: row?.new_application_email ?? true,
    newApplicationInApp: row?.new_application_in_app ?? true,
    productUpdatesEmail: row?.product_updates_email ?? row?.product_updates ?? true,
  };
}

export async function getRecruiterNotificationPreferences(userId: string) {
  if (!supabase) {
    return { error: "Supabase is not configured.", preferences: defaultRecruiterNotificationPreferences };
  }

  try {
    const identity = await getRecruiterIdentity(userId);
    if (identity.error || !identity.userId) {
      return { error: identity.error, preferences: defaultRecruiterNotificationPreferences };
    }

    const { data, error } = await supabase
      .from("email_preferences")
      .select(recruiterNotificationSelect)
      .eq("user_id", identity.userId)
      .maybeSingle();

    if (error) {
      logAuthError("[recruiter-settings] notification preferences fetch failed", error);
      return { error: "We could not load notification preferences.", preferences: defaultRecruiterNotificationPreferences };
    }

    if (!data) {
      return updateRecruiterNotificationPreferences({
        preferences: defaultRecruiterNotificationPreferences,
        userId: identity.userId,
      });
    }

    return { error: null, preferences: mapRecruiterNotificationRow(data as RecruiterNotificationRow) };
  } catch (error) {
    logAuthError("[recruiter-settings] notification preferences fetch network failure", error);
    return { error: getFriendlyRecruiterSettingsError(error), preferences: defaultRecruiterNotificationPreferences };
  }
}

export async function updateRecruiterNotificationPreferences({
  preferences,
  userId,
}: {
  preferences: RecruiterNotificationPreferences;
  userId: string;
}) {
  if (!supabase) {
    return { error: "Supabase is not configured.", preferences };
  }

  try {
    const identity = await getRecruiterIdentity(userId);
    if (identity.error || !identity.userId) {
      return { error: identity.error, preferences };
    }

    const { data, error } = await supabase
      .from("email_preferences")
      .upsert(
        {
          admin_messages_email: preferences.adminMessagesEmail,
          admin_messages_in_app: preferences.adminMessagesInApp,
          candidate_status_updates_email: preferences.candidateStatusUpdatesEmail,
          candidate_status_updates_in_app: preferences.candidateStatusUpdatesInApp,
          interview_cancelled_email: preferences.interviewCancelledEmail,
          interview_cancelled_in_app: preferences.interviewCancelledInApp,
          interview_reminders_email: preferences.interviewRemindersEmail,
          interview_reminders_in_app: preferences.interviewRemindersInApp,
          interview_rescheduled_email: preferences.interviewRescheduledEmail,
          interview_rescheduled_in_app: preferences.interviewRescheduledInApp,
          job_expiry_reminders_email: preferences.jobExpiryRemindersEmail,
          job_expiry_reminders_in_app: preferences.jobExpiryRemindersInApp,
          new_application_email: preferences.newApplicationEmail,
          new_application_in_app: preferences.newApplicationInApp,
          product_updates: preferences.productUpdatesEmail,
          product_updates_email: preferences.productUpdatesEmail,
          security_emails: true,
          user_id: identity.userId,
        },
        { onConflict: "user_id" },
      )
      .select(recruiterNotificationSelect)
      .maybeSingle();

    if (error) {
      logAuthError("[recruiter-settings] notification preferences update failed", error);
      return { error: getFriendlyRecruiterSettingsError(error), preferences };
    }

    return {
      error: null,
      preferences: mapRecruiterNotificationRow((data ?? null) as RecruiterNotificationRow | null),
    };
  } catch (error) {
    logAuthError("[recruiter-settings] notification preferences update network failure", error);
    return { error: getFriendlyRecruiterSettingsError(error), preferences };
  }
}

function mapDeletionRequest(row: unknown): RecruiterDeletionRequest | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const value = row as Record<string, unknown>;
  if (typeof value.id !== "string" || typeof value.status !== "string" || typeof value.requested_at !== "string") {
    return null;
  }

  return {
    id: value.id,
    reason: typeof value.reason === "string" ? value.reason : null,
    requestedAt: value.requested_at,
    status: value.status,
  };
}

export async function getRecruiterDeletionRequest() {
  if (!supabase) {
    return { error: "Supabase is not configured.", request: null };
  }

  try {
    const { data, error } = await supabase.rpc("get_recruiter_account_deletion_request");
    if (error) {
      return { error: getFriendlyRecruiterSettingsError(error), request: null };
    }
    return { error: null, request: mapDeletionRequest(Array.isArray(data) ? data[0] : data) };
  } catch (error) {
    return { error: getFriendlyRecruiterSettingsError(error), request: null };
  }
}

export async function requestRecruiterAccountDeletion(reason: string) {
  if (!supabase) {
    return { error: "Supabase is not configured.", request: null };
  }

  try {
    const { data, error } = await supabase.rpc("request_recruiter_account_deletion", {
      p_reason: reason.trim() || null,
    });
    if (error) {
      return { error: getFriendlyRecruiterSettingsError(error), request: null };
    }
    return { error: null, request: mapDeletionRequest(Array.isArray(data) ? data[0] : data) };
  } catch (error) {
    return { error: getFriendlyRecruiterSettingsError(error), request: null };
  }
}
