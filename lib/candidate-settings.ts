import { getEmailPreferences } from "@/lib/email/preferences";
import type { JobAlertFrequency } from "@/lib/job-alerts";
import { supabase } from "@/lib/supabase";

export const privacyVisibilityOptions = ["private", "application_only"] as const;
export type CandidatePrivacyVisibility = (typeof privacyVisibilityOptions)[number];

export type CandidatePrivacySettings = {
  profileVisibility: CandidatePrivacyVisibility;
  recruiterDiscoverable: boolean;
  resumeVisibility: CandidatePrivacyVisibility;
  showExperience: boolean;
  showLocation: boolean;
  showPortfolio: boolean;
  showSocialLinks: boolean;
};

export type CandidateNotificationPreferences = {
  adminMessagesEmail: boolean;
  adminMessagesInApp: boolean;
  applicationUpdatesEmail: boolean;
  applicationUpdatesInApp: boolean;
  billingUpdatesEmail: boolean;
  billingUpdatesInApp: boolean;
  jobAlertsEmail: boolean;
  jobAlertsEnabled: boolean;
  jobAlertsFrequency: JobAlertFrequency;
  jobAlertsInApp: boolean;
  productUpdatesEmail: boolean;
  productUpdatesInApp: boolean;
  relevantJobsEmail: boolean;
  relevantJobsInApp: boolean;
  savedJobRemindersEmail: boolean;
  securityUpdatesInApp: boolean;
};

export type CandidateDeletionRequest = {
  id: string;
  reason: string | null;
  requestedAt: string;
  status: string;
};

export const defaultCandidatePrivacySettings: CandidatePrivacySettings = {
  profileVisibility: "application_only",
  recruiterDiscoverable: false,
  resumeVisibility: "application_only",
  showExperience: true,
  showLocation: true,
  showPortfolio: true,
  showSocialLinks: true,
};

export const defaultCandidateNotificationPreferences: CandidateNotificationPreferences = {
  adminMessagesEmail: true,
  adminMessagesInApp: true,
  applicationUpdatesEmail: true,
  applicationUpdatesInApp: true,
  billingUpdatesEmail: true,
  billingUpdatesInApp: true,
  jobAlertsEmail: true,
  jobAlertsEnabled: true,
  jobAlertsFrequency: "daily",
  jobAlertsInApp: true,
  productUpdatesEmail: true,
  productUpdatesInApp: true,
  relevantJobsEmail: true,
  relevantJobsInApp: true,
  savedJobRemindersEmail: true,
  securityUpdatesInApp: true,
};

type PrivacyRow = {
  profile_visibility?: string | null;
  recruiter_discoverable?: boolean | null;
  resume_visibility?: string | null;
  show_experience?: boolean | null;
  show_location?: boolean | null;
  show_portfolio?: boolean | null;
  show_social_links?: boolean | null;
};

type NotificationRow = {
  admin_messages_email?: boolean | null;
  admin_messages_in_app?: boolean | null;
  application_updates_email?: boolean | null;
  application_updates_in_app?: boolean | null;
  billing_updates_email?: boolean | null;
  billing_updates_in_app?: boolean | null;
  job_alert_frequency?: string | null;
  job_alerts_email?: boolean | null;
  job_alerts_enabled?: boolean | null;
  job_alerts_in_app?: boolean | null;
  job_notifications?: boolean | null;
  product_updates?: boolean | null;
  product_updates_email?: boolean | null;
  product_updates_in_app?: boolean | null;
  relevant_jobs_email?: boolean | null;
  relevant_jobs_in_app?: boolean | null;
  saved_job_reminders_email?: boolean | null;
  security_updates_in_app?: boolean | null;
};

type DeletionRow = {
  id?: string | null;
  reason?: string | null;
  requested_at?: string | null;
  status?: string | null;
};

function isFrequency(value: unknown): value is JobAlertFrequency {
  return value === "instant" || value === "daily" || value === "weekly";
}

function friendlySettingsError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("job_seeker_required") || normalized.includes("permission")) {
    return "Only your own candidate settings can be changed.";
  }

  if (normalized.includes("authentication") || normalized.includes("jwt")) {
    return "Your session expired. Please sign in again.";
  }

  if (normalized.includes("deletion_request_already_exists")) {
    return "An account deletion request is already under review.";
  }

  if (normalized.includes("failed to fetch") || normalized.includes("network")) {
    return "We could not connect. Please check your internet connection and try again.";
  }

  return "We could not save your settings. Please try again.";
}

async function getAuthenticatedUserId(expectedUserId?: string) {
  if (!supabase) {
    return { error: "Supabase is not configured.", userId: null };
  }

  const { data, error } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;

  if (error || !userId) {
    return { error: "Your session expired. Please sign in again.", userId: null };
  }

  if (expectedUserId && expectedUserId !== userId) {
    return { error: "Only your own settings can be changed.", userId: null };
  }

  return { error: null, userId };
}

export function mapCandidatePrivacyRow(row: PrivacyRow | null): CandidatePrivacySettings {
  return {
    profileVisibility:
      row?.profile_visibility === "private" ? "private" : "application_only",
    recruiterDiscoverable: row?.recruiter_discoverable === true,
    resumeVisibility:
      row?.resume_visibility === "private" ? "private" : "application_only",
    showExperience: row?.show_experience ?? true,
    showLocation: row?.show_location ?? true,
    showPortfolio: row?.show_portfolio ?? true,
    showSocialLinks: row?.show_social_links ?? true,
  };
}

export function mapCandidateNotificationRow(
  row: NotificationRow | null,
): CandidateNotificationPreferences {
  return {
    adminMessagesEmail: row?.admin_messages_email ?? true,
    adminMessagesInApp: row?.admin_messages_in_app ?? true,
    applicationUpdatesEmail: row?.application_updates_email ?? true,
    applicationUpdatesInApp: row?.application_updates_in_app ?? true,
    billingUpdatesEmail: row?.billing_updates_email ?? true,
    billingUpdatesInApp: row?.billing_updates_in_app ?? true,
    jobAlertsEmail: row?.job_alerts_email ?? row?.job_notifications ?? true,
    jobAlertsEnabled: row?.job_alerts_enabled ?? true,
    jobAlertsFrequency: isFrequency(row?.job_alert_frequency)
      ? row.job_alert_frequency
      : "daily",
    jobAlertsInApp: row?.job_alerts_in_app ?? true,
    productUpdatesEmail: row?.product_updates_email ?? row?.product_updates ?? true,
    productUpdatesInApp: row?.product_updates_in_app ?? true,
    relevantJobsEmail: row?.relevant_jobs_email ?? true,
    relevantJobsInApp: row?.relevant_jobs_in_app ?? true,
    savedJobRemindersEmail: row?.saved_job_reminders_email ?? true,
    securityUpdatesInApp: row?.security_updates_in_app ?? true,
  };
}

function mapDeletionRow(row: DeletionRow | null): CandidateDeletionRequest | null {
  if (!row?.id || !row.requested_at || !row.status) {
    return null;
  }

  return {
    id: row.id,
    reason: row.reason ?? null,
    requestedAt: row.requested_at,
    status: row.status,
  };
}

export async function getCandidatePrivacySettings() {
  if (!supabase) {
    return { error: "Supabase is not configured.", settings: defaultCandidatePrivacySettings };
  }

  try {
    const { data, error } = await supabase.rpc("get_candidate_privacy_settings");

    if (error) {
      return { error: friendlySettingsError(error), settings: defaultCandidatePrivacySettings };
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return updateCandidatePrivacySettings(defaultCandidatePrivacySettings);
    }

    return { error: null, settings: mapCandidatePrivacyRow(row as PrivacyRow) };
  } catch (error) {
    return { error: friendlySettingsError(error), settings: defaultCandidatePrivacySettings };
  }
}

export async function updateCandidatePrivacySettings(settings: CandidatePrivacySettings) {
  if (!supabase) {
    return { error: "Supabase is not configured.", settings };
  }

  try {
    const { data, error } = await supabase.rpc("upsert_candidate_privacy_settings", {
      p_profile_visibility: settings.profileVisibility,
      p_recruiter_discoverable: settings.recruiterDiscoverable,
      p_resume_visibility: settings.resumeVisibility,
      p_show_experience: settings.showExperience,
      p_show_location: settings.showLocation,
      p_show_portfolio: settings.showPortfolio,
      p_show_social_links: settings.showSocialLinks,
    });

    if (error) {
      return { error: friendlySettingsError(error), settings };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return { error: null, settings: mapCandidatePrivacyRow((row ?? null) as PrivacyRow | null) };
  } catch (error) {
    return { error: friendlySettingsError(error), settings };
  }
}

export async function getCandidateNotificationPreferences(userId: string) {
  if (!supabase) {
    return {
      error: "Supabase is not configured.",
      preferences: defaultCandidateNotificationPreferences,
    };
  }

  try {
    const identity = await getAuthenticatedUserId(userId);

    if (identity.error || !identity.userId) {
      return {
        error: identity.error,
        preferences: defaultCandidateNotificationPreferences,
      };
    }

    const legacyResult = await getEmailPreferences(identity.userId);
    const { data, error } = await supabase
      .from("email_preferences")
      .select("admin_messages_email, admin_messages_in_app, application_updates_email, application_updates_in_app, billing_updates_email, billing_updates_in_app, job_alert_frequency, job_alerts_email, job_alerts_enabled, job_alerts_in_app, job_notifications, product_updates, product_updates_email, product_updates_in_app, relevant_jobs_email, relevant_jobs_in_app, saved_job_reminders_email, security_updates_in_app")
      .eq("user_id", identity.userId)
      .maybeSingle();

    if (error) {
      return {
        error: "We could not load notification preferences.",
        preferences: defaultCandidateNotificationPreferences,
      };
    }

    const preferences = mapCandidateNotificationRow(data as NotificationRow | null);

    if (!data) {
      return updateCandidateNotificationPreferences({
        preferences,
        userId: identity.userId,
      });
    }

    return { error: legacyResult.error, preferences };
  } catch (error) {
    return {
      error: friendlySettingsError(error),
      preferences: defaultCandidateNotificationPreferences,
    };
  }
}

export async function updateCandidateNotificationPreferences({
  preferences,
  userId,
}: {
  preferences: CandidateNotificationPreferences;
  userId: string;
}) {
  if (!supabase) {
    return { error: "Supabase is not configured.", preferences };
  }

  try {
    const identity = await getAuthenticatedUserId(userId);

    if (identity.error || !identity.userId) {
      return { error: identity.error, preferences };
    }

    const { data, error } = await supabase
      .from("email_preferences")
      .upsert(
        {
          admin_messages_email: preferences.adminMessagesEmail,
          admin_messages_in_app: preferences.adminMessagesInApp,
          application_updates_email: preferences.applicationUpdatesEmail,
          application_updates_in_app: preferences.applicationUpdatesInApp,
          billing_updates_email: preferences.billingUpdatesEmail,
          billing_updates_in_app: preferences.billingUpdatesInApp,
          job_alert_frequency: preferences.jobAlertsFrequency,
          job_alerts_email: preferences.jobAlertsEmail,
          job_alerts_enabled: preferences.jobAlertsEnabled,
          job_alerts_in_app: preferences.jobAlertsInApp,
          job_notifications: preferences.jobAlertsEmail,
          product_updates: preferences.productUpdatesEmail,
          product_updates_email: preferences.productUpdatesEmail,
          product_updates_in_app: preferences.productUpdatesInApp,
          relevant_jobs_email: preferences.relevantJobsEmail,
          relevant_jobs_in_app: preferences.relevantJobsInApp,
          saved_job_reminders_email: preferences.savedJobRemindersEmail,
          security_emails: true,
          security_updates_in_app: true,
          user_id: identity.userId,
        },
        { onConflict: "user_id" },
      )
      .select("admin_messages_email, admin_messages_in_app, application_updates_email, application_updates_in_app, billing_updates_email, billing_updates_in_app, job_alert_frequency, job_alerts_email, job_alerts_enabled, job_alerts_in_app, job_notifications, product_updates, product_updates_email, product_updates_in_app, relevant_jobs_email, relevant_jobs_in_app, saved_job_reminders_email, security_updates_in_app")
      .maybeSingle();

    if (error) {
      return { error: friendlySettingsError(error), preferences };
    }

    return {
      error: null,
      preferences: mapCandidateNotificationRow(data as NotificationRow | null),
    };
  } catch (error) {
    return { error: friendlySettingsError(error), preferences };
  }
}

export async function getCandidateDeletionRequest() {
  if (!supabase) {
    return { error: "Supabase is not configured.", request: null };
  }

  try {
    const { data, error } = await supabase.rpc("get_candidate_account_deletion_request");

    if (error) {
      return { error: friendlySettingsError(error), request: null };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return { error: null, request: mapDeletionRow((row ?? null) as DeletionRow | null) };
  } catch (error) {
    return { error: friendlySettingsError(error), request: null };
  }
}

export async function requestCandidateAccountDeletion(reason: string) {
  if (!supabase) {
    return { error: "Supabase is not configured.", request: null };
  }

  try {
    const { data, error } = await supabase.rpc("request_candidate_account_deletion", {
      p_reason: reason.trim() || null,
    });

    if (error) {
      return { error: friendlySettingsError(error), request: null };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return { error: null, request: mapDeletionRow((row ?? null) as DeletionRow | null) };
  } catch (error) {
    return { error: friendlySettingsError(error), request: null };
  }
}

export function validateCandidatePassword(password: string, confirmation: string) {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Use at least one uppercase letter, one lowercase letter, and one number.";
  }

  if (password !== confirmation) {
    return "New password and confirmation do not match.";
  }

  return null;
}
