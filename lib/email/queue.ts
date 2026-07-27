import "server-only";

import { createEmailMessage, createEmailProvider } from "@/lib/email/providers";
import {
  canSendEmailCategory,
  defaultEmailPreferences,
  mapEmailPreferencesRow,
} from "@/lib/email/preferences";
import { renderEmailTemplate } from "@/lib/email/templates";
import type {
  EmailCategory,
  EmailEventInput,
  EmailEventType,
  EmailPreferenceState,
  EmailTemplateData,
  EmailTemplateKey,
} from "@/lib/email/types";
import {
  emailCategories,
  emailEventTypes,
  emailTemplateKeys,
} from "@/lib/email/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const maxAttempts = 3;

type EmailQueueRow = {
  attempts: number | null;
  category: string | null;
  dedupe_key: string;
  event_type: string;
  html: string;
  id: string;
  recipient_email: string;
  recipient_user_id: string | null;
  subject: string;
  template_data: unknown;
  template_key: string | null;
  text: string;
};

type EmailPreferencesRow = {
  admin_messages_email?: boolean | null;
  job_notifications?: boolean | null;
  product_updates?: boolean | null;
  security_emails?: boolean | null;
};

type EnqueueEmailEventResult = {
  error: string | null;
  queued: boolean;
  skipped: boolean;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function readDataValue(event: EmailEventInput, key: string) {
  const value = event.data?.[key];

  return typeof value === "string" ? value : "";
}

function readTemplateData(value: unknown): EmailTemplateData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const data: EmailTemplateData = {};

  for (const [key, item] of Object.entries(value)) {
    if (
      !/^[a-z][a-zA-Z0-9_]{0,63}$/.test(key) ||
      /(password|secret|token|cookie|authorization|email|phone|resume|internal|note)/i.test(key)
    ) {
      continue;
    }

    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
      data[key] = typeof item === "string" ? item.slice(0, 2000) : item;
    }
  }

  return data;
}

function isEmailEventType(value: string): value is EmailEventType {
  return emailEventTypes.includes(value as EmailEventType);
}

function createDefaultDedupeKey(event: EmailEventInput) {
  const recipientKey = event.recipient.userId ?? normalizeEmail(event.recipient.email);

  if (event.type.startsWith("job_")) {
    const jobId = readDataValue(event, "jobId") || readDataValue(event, "jobTitle");
    const marker =
      readDataValue(event, "publishAt") ||
      readDataValue(event, "status") ||
      new Date().toISOString().slice(0, 10);

    return `${event.type}:${recipientKey}:${jobId}:${marker}`;
  }

  if (event.type === "password_reset") {
    return `${event.type}:${recipientKey}:${new Date().toISOString().slice(0, 10)}`;
  }

  return `${event.type}:${recipientKey}`;
}

function getRetryTime(attempts: number) {
  const retryDelayMinutes = Math.min(60, Math.max(2, 2 ** attempts));

  return new Date(Date.now() + retryDelayMinutes * 60 * 1000).toISOString();
}

async function loadPreferences(
  userId: string | null | undefined,
): Promise<EmailPreferenceState> {
  if (!userId) {
    return defaultEmailPreferences;
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return defaultEmailPreferences;
  }

  const { data, error } = await supabase
    .from("email_preferences")
    .select("admin_messages_email, product_updates, job_notifications, security_emails")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[email-queue] preference lookup failed", {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return defaultEmailPreferences;
  }

  return mapEmailPreferencesRow(data as EmailPreferencesRow | null);
}

export async function enqueueEmailEvent(
  event: EmailEventInput,
): Promise<EnqueueEmailEventResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      error: "Email queue is not configured.",
      queued: false,
      skipped: false,
    };
  }

  const recipientEmail = normalizeEmail(event.recipient.email);

  if (!recipientEmail) {
    return {
      error: "Email recipient is missing.",
      queued: false,
      skipped: true,
    };
  }

  const rendered = renderEmailTemplate(event);
  const preferences = await loadPreferences(event.recipient.userId);

  if (
    !canSendEmailCategory({
      category: rendered.category,
      preferences,
    })
  ) {
    return {
      error: null,
      queued: false,
      skipped: true,
    };
  }

  const { error } = await supabase.from("email_queue").insert({
    category: rendered.category,
    dedupe_key: event.dedupeKey ?? createDefaultDedupeKey(event),
    event_type: event.type,
    html: rendered.html,
    max_attempts: maxAttempts,
    recipient_email: recipientEmail,
    recipient_user_id: event.recipient.userId ?? null,
    status: "queued",
    subject: rendered.subject,
    template_data: event.data ?? {},
    template_key: rendered.templateKey,
    text: rendered.text,
  });

  if (!error) {
    return {
      error: null,
      queued: true,
      skipped: false,
    };
  }

  if (error.code === "23505") {
    return {
      error: null,
      queued: false,
      skipped: true,
    };
  }

  if (process.env.NODE_ENV === "development") {
    console.error("[email-queue] enqueue failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }

  return {
    error: "Email could not be queued.",
    queued: false,
    skipped: false,
  };
}

export async function processEmailQueue({ limit = 20 }: { limit?: number } = {}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      failed: 0,
      processed: 0,
      sent: 0,
      error: "Email queue is not configured.",
    };
  }

  const { data, error } = await supabase
    .from("email_queue")
    .select("id, recipient_email, recipient_user_id, subject, html, text, category, template_key, template_data, event_type, dedupe_key, attempts")
    .in("status", ["queued", "failed"])
    .lt("attempts", maxAttempts)
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[email-queue] fetch failed", {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return {
      failed: 0,
      processed: 0,
      sent: 0,
      error: "Email queue could not be loaded.",
    };
  }

  const provider = createEmailProvider();
  const preferenceCache = new Map<string, EmailPreferenceState>();
  let sent = 0;
  let failed = 0;

  for (const row of (data ?? []) as EmailQueueRow[]) {
    const attempts = row.attempts ?? 0;

    const { data: claim, error: claimError } = await supabase
      .from("email_queue")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .in("status", ["queued", "failed"])
      .select("id")
      .maybeSingle();

    if (claimError || !claim) {
      continue;
    }

    const rendered = isEmailEventType(row.event_type)
      ? renderEmailTemplate({
          data: readTemplateData(row.template_data),
          recipient: { email: row.recipient_email },
          type: row.event_type,
        })
      : {
          category: emailCategories.includes(row.category as EmailCategory)
            ? (row.category as EmailCategory)
            : "security_emails",
          html: row.html,
          subject: row.subject,
          templateKey: emailTemplateKeys.includes(row.template_key as EmailTemplateKey)
            ? (row.template_key as EmailTemplateKey)
            : "recruiter_account_notification",
          text: row.text,
        };

    if (row.recipient_user_id) {
      const preferences =
        preferenceCache.get(row.recipient_user_id) ??
        (await loadPreferences(row.recipient_user_id));
      preferenceCache.set(row.recipient_user_id, preferences);

      if (
        !canSendEmailCategory({
          category: rendered.category,
          preferences,
        })
      ) {
        await supabase
          .from("email_queue")
          .update({
            last_error: null,
            status: "discarded",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("status", "processing");
        continue;
      }
    }

    const result = await provider.sendEmail(
      createEmailMessage({
        idempotencyKey: row.dedupe_key,
        rendered,
        to: row.recipient_email,
      }),
    );

    if (result.success) {
      sent += 1;
      await supabase
        .from("email_queue")
        .update({
          attempts: attempts + 1,
          last_error: null,
          provider_message_id: result.providerMessageId ?? null,
          sent_at: new Date().toISOString(),
          status: "sent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      continue;
    }

    failed += 1;
    const nextAttempts = attempts + 1;
    await supabase
      .from("email_queue")
      .update({
        attempts: nextAttempts,
        last_error: result.error ?? "Email provider failed.",
        next_attempt_at:
          nextAttempts >= maxAttempts
            ? null
            : getRetryTime(nextAttempts),
        status: nextAttempts >= maxAttempts ? "failed" : "queued",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }

  return {
    error: null,
    failed,
    processed: (data ?? []).length,
    sent,
  };
}
