export const emailCategories = [
  "admin_messages",
  "product_updates",
  "job_notifications",
  "security_emails",
] as const;

export const emailTemplateKeys = [
  "admin_message",
  "application_rejected",
  "application_shortlisted",
  "application_status_changed",
  "application_submitted",
  "interview_cancelled",
  "interview_rescheduled",
  "interview_scheduled",
  "new_applicant",
  "welcome",
  "verify_email",
  "password_reset",
  "job_submitted",
  "job_scheduled",
  "job_published",
  "job_closed",
  "recruiter_account_notification",
] as const;

export const emailEventTypes = [
  "admin_message",
  "application_received",
  "application_status_changed",
  "application_submitted",
  "application_withdrawn",
  "interview_cancelled",
  "interview_rescheduled",
  "interview_scheduled",
  "account_created",
  "verify_email_requested",
  "password_reset",
  "job_submitted",
  "job_scheduled",
  "job_published",
  "job_closed",
  "recruiter_account_notification",
] as const;

export type EmailCategory = (typeof emailCategories)[number];
export type EmailTemplateKey = (typeof emailTemplateKeys)[number];
export type EmailEventType = (typeof emailEventTypes)[number];

export type EmailRecipient = {
  email: string;
  userId?: string | null;
};

export type EmailTemplateData = Record<string, string | number | boolean | null>;

export type RenderedEmail = {
  category: EmailCategory;
  html: string;
  subject: string;
  templateKey: EmailTemplateKey;
  text: string;
};

export type EmailMessage = RenderedEmail & {
  from: string;
  idempotencyKey?: string;
  replyTo?: string | null;
  to: string;
};

export type EmailSendResult = {
  error?: string;
  providerMessageId?: string;
  success: boolean;
};

export type EmailProvider = {
  id: string;
  sendEmail: (message: EmailMessage) => Promise<EmailSendResult>;
};

export type EmailPreferenceState = {
  adminMessagesEmail: boolean;
  jobNotifications: boolean;
  productUpdates: boolean;
  securityEmails: true;
};

export type EmailEventInput = {
  data?: EmailTemplateData;
  dedupeKey?: string;
  recipient: EmailRecipient;
  type: EmailEventType;
};

export type ClientEmailEventRequest =
  | {
      type: "account_created" | "password_reset";
    }
  | {
      jobId: string;
      type: "job_published" | "job_scheduled" | "job_submitted";
    };
