import { CONNECTION_ERROR_MESSAGE, logAuthError } from "@/lib/auth-errors";
import type {
  EmailCategory,
  EmailPreferenceState,
} from "@/lib/email/types";
import { supabase } from "@/lib/supabase";

type EmailPreferencesRow = {
  admin_messages_email?: boolean | null;
  job_notifications?: boolean | null;
  product_updates?: boolean | null;
  security_emails?: boolean | null;
  user_id?: string | null;
};

export const defaultEmailPreferences: EmailPreferenceState = {
  adminMessagesEmail: true,
  jobNotifications: true,
  productUpdates: true,
  securityEmails: true,
};

export function mapEmailPreferencesRow(
  row: EmailPreferencesRow | null,
): EmailPreferenceState {
  return {
    adminMessagesEmail: row?.admin_messages_email ?? true,
    jobNotifications: row?.job_notifications ?? true,
    productUpdates: row?.product_updates ?? true,
    securityEmails: true,
  };
}

export function canSendEmailCategory({
  category,
  preferences,
}: {
  category: EmailCategory;
  preferences: EmailPreferenceState;
}) {
  if (category === "security_emails") {
    return true;
  }

  if (category === "job_notifications") {
    return preferences.jobNotifications;
  }

  if (category === "admin_messages") {
    return preferences.adminMessagesEmail;
  }

  return preferences.productUpdates;
}

export async function getEmailPreferences(userId: string) {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      preferences: defaultEmailPreferences,
    };
  }

  try {
    const { data, error } = await supabase
      .from("email_preferences")
      .select("user_id, admin_messages_email, product_updates, job_notifications, security_emails")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      logAuthError("[email-preferences] fetch failed", error);

      return {
        error: "We could not load email preferences.",
        preferences: defaultEmailPreferences,
      };
    }

    return {
      error: null,
      preferences: mapEmailPreferencesRow(data as EmailPreferencesRow | null),
    };
  } catch (error) {
    logAuthError("[email-preferences] fetch network failure", error);

    return {
      error: CONNECTION_ERROR_MESSAGE,
      preferences: defaultEmailPreferences,
    };
  }
}

export async function updateEmailPreferences({
  preferences,
  userId,
}: {
  preferences: EmailPreferenceState;
  userId: string;
}) {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      preferences: defaultEmailPreferences,
    };
  }

  try {
    const { data, error } = await supabase
      .from("email_preferences")
      .upsert(
        {
          job_notifications: preferences.jobNotifications,
          admin_messages_email: preferences.adminMessagesEmail,
          product_updates: preferences.productUpdates,
          security_emails: true,
          user_id: userId,
        },
        { onConflict: "user_id" },
      )
      .select("user_id, admin_messages_email, product_updates, job_notifications, security_emails")
      .maybeSingle();

    if (error) {
      logAuthError("[email-preferences] update failed", error);

      return {
        error: "We could not update email preferences.",
        preferences,
      };
    }

    return {
      error: null,
      preferences: mapEmailPreferencesRow(data as EmailPreferencesRow | null),
    };
  } catch (error) {
    logAuthError("[email-preferences] update network failure", error);

    return {
      error: CONNECTION_ERROR_MESSAGE,
      preferences,
    };
  }
}
