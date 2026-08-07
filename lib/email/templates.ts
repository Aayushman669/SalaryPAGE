import "server-only";

import type {
  EmailCategory,
  EmailEventInput,
  EmailTemplateData,
  EmailTemplateKey,
  RenderedEmail,
} from "@/lib/email/types";

type TemplateDefinition = {
  category: EmailCategory;
  render: (data: EmailTemplateData) => Omit<RenderedEmail, "category" | "templateKey">;
  templateKey: EmailTemplateKey;
};

const appName = "JobForge";

function siteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "";
  const value = configured.trim();

  if (!value) {
    return "";
  }

  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.origin;
  } catch {
    return "";
  }
}

function safeEmailUrl(value: string) {
  const candidate = value.trim();

  if (!candidate) {
    return "";
  }

  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    const origin = siteUrl();
    return origin ? `${origin}${candidate}` : "";
  }

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function configuredAssetUrl(value: string | undefined) {
  if (!value) {
    return "";
  }

  return safeEmailUrl(value);
}

function escapeHtml(value: string | number | boolean | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textValue(data: EmailTemplateData, key: string, fallback = "") {
  const value = data[key];

  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatDateTime(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(parsedDate);
}

function renderLayout({
  body,
  eyebrow,
  preview,
  title,
}: {
  body: string;
  eyebrow: string;
  preview: string;
  title: string;
}) {
  const logoUrl = configuredAssetUrl(process.env.EMAIL_LOGO_URL);
  const supportEmail = process.env.EMAIL_SUPPORT_ADDRESS?.trim() ?? "";
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(appName)}" width="40" height="40" style="display:block;border-radius:10px;margin-bottom:18px" />`
    : "";
  const support = supportEmail
    ? ` Need help? Contact ${escapeHtml(supportEmail)}.`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin: 0; background: #f8fafc; color: #111827; font-family: Arial, Helvetica, sans-serif; }
      .shell { width: 100%; padding: 32px 16px; }
      .card { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 80px rgba(17,24,39,0.10); }
      .header { padding: 28px 28px 0; }
      .badge { display: inline-block; border: 1px solid #eab308; border-radius: 999px; padding: 6px 10px; color: #111827; background: #fefce8; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
      h1 { margin: 18px 0 0; font-size: 26px; line-height: 1.2; color: #111827; }
      .content { padding: 22px 28px 30px; color: #4b5563; font-size: 15px; line-height: 1.7; }
      .panel { margin-top: 18px; border: 1px solid #e5e7eb; background: #f8fafc; border-radius: 16px; padding: 16px; }
      .button { display: inline-block; margin-top: 18px; padding: 12px 16px; border-radius: 12px; background: #111827; color: #ffffff !important; text-decoration: none; font-weight: 700; }
      .footer { padding: 18px 28px 28px; color: #6b7280; font-size: 12px; line-height: 1.6; }
      .preview { display: none; overflow: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
      @media (prefers-color-scheme: dark) {
        body { background: #0f0f10; color: #f5f5f5; }
        .card { background: #171719; border-color: #2a2a2e; box-shadow: none; }
        .badge { background: rgba(234,179,8,0.14); border-color: rgba(234,179,8,0.55); color: #f5f5f5; }
        h1 { color: #f5f5f5; }
        .content { color: #d4d4d8; }
        .panel { background: #1d1d20; border-color: #2a2a2e; }
        .footer { color: #a1a1aa; }
      }
    </style>
  </head>
  <body>
    <div class="preview">${escapeHtml(preview)}</div>
    <div class="shell">
      <div class="card">
        <div class="header">
          ${logo}
          <span class="badge">${escapeHtml(eyebrow)}</span>
          <h1>${escapeHtml(title)}</h1>
        </div>
        <div class="content">${body}</div>
        <div class="footer">
          You received this email from ${escapeHtml(appName)}.${support} Security emails cannot be disabled.
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function paragraph(value: string) {
  return `<p>${escapeHtml(value)}</p>`;
}

function actionLink(label: string, href: string) {
  const safeHref = safeEmailUrl(href);
  return safeHref
    ? `<a class="button" href="${escapeHtml(safeHref)}">${escapeHtml(label)}</a>`
    : "";
}

function templateText(lines: Array<string | null | undefined>) {
  return lines.filter(Boolean).join("\n\n");
}

function renderNotificationEmail({
  data,
  eyebrow,
  fallbackMessage,
  preview,
  subject,
  title,
}: {
  data: EmailTemplateData;
  eyebrow: string;
  fallbackMessage: string;
  preview: string;
  subject: string;
  title: string;
}) {
  const fullName = textValue(data, "fullName", "there");
  const message = textValue(data, "message", fallbackMessage);
  const actionHref = textValue(data, "actionHref");
  const body =
    paragraph(`Hi ${fullName},`) +
    paragraph(message) +
    actionLink("Open JobForge", actionHref || `${siteUrl()}/dashboard`);

  return {
    subject,
    text: templateText([
      `Hi ${fullName},`,
      message,
      safeEmailUrl(actionHref || `${siteUrl()}/dashboard`) || null,
    ]),
    html: renderLayout({ body, eyebrow, preview, title }),
  };
}

function statusMessage(data: EmailTemplateData) {
  const status = textValue(data, "status").replace(/_/g, " ");
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "shortlisted") {
    return "Your application has been shortlisted.";
  }

  if (normalizedStatus === "rejected") {
    return "Your application status has been updated. Please review the application for the latest details.";
  }

  return status
    ? `Your application status is now ${status}.`
    : "Your application status has been updated.";
}

const templates: Record<EmailTemplateKey, TemplateDefinition> = {
  welcome: {
    category: "product_updates",
    templateKey: "welcome",
    render: (data) => {
      const fullName = textValue(data, "fullName", "there");
      const dashboardUrl = `${siteUrl()}/dashboard`;

      return {
        subject: `Welcome to ${appName}`,
        text: templateText([
          `Welcome to ${appName}, ${fullName}.`,
          "Your account is ready. Finish your profile and start using the platform.",
          dashboardUrl || null,
        ]),
        html: renderLayout({
          body:
            paragraph(`Hi ${fullName}, welcome to ${appName}.`) +
            paragraph("Your account is ready. Finish your profile and start using the platform.") +
            actionLink("Open Dashboard", dashboardUrl),
          eyebrow: "Welcome",
          preview: `Welcome to ${appName}.`,
          title: "Your JobForge account is ready.",
        }),
      };
    },
  },
  verify_email: {
    category: "security_emails",
    templateKey: "verify_email",
    render: (data) => {
      const verifyUrl = textValue(data, "verifyUrl", `${siteUrl()}/verify-email`);

      return {
        subject: "Verify your email",
        text: templateText([
          "Verify your email address to continue using JobForge.",
          verifyUrl,
        ]),
        html: renderLayout({
          body:
            paragraph("Verify your email address to continue using JobForge.") +
            actionLink("Verify Email", verifyUrl),
          eyebrow: "Security",
          preview: "Verify your JobForge email address.",
          title: "Verify your email",
        }),
      };
    },
  },
  password_reset: {
    category: "security_emails",
    templateKey: "password_reset",
    render: (data) => {
      const resetUrl = textValue(data, "resetUrl", `${siteUrl()}/forgot-password`);

      return {
        subject: "Password reset update",
        text: templateText([
          "Your JobForge password was updated or a password reset was requested.",
          "If this was not you, secure your account immediately.",
          resetUrl,
        ]),
        html: renderLayout({
          body:
            paragraph("Your JobForge password was updated or a password reset was requested.") +
            paragraph("If this was not you, secure your account immediately.") +
            actionLink("Review Account", resetUrl),
          eyebrow: "Security",
          preview: "Password reset activity on your account.",
          title: "Password reset activity",
        }),
      };
    },
  },
  application_submitted: {
    category: "job_notifications",
    templateKey: "application_submitted",
    render: (data) => {
      const jobTitle = textValue(data, "jobTitle", "the role");
      const companyName = textValue(data, "companyName", "the company");

      return renderNotificationEmail({
        data,
        eyebrow: "Application submitted",
        fallbackMessage: `Your application for ${jobTitle} at ${companyName} was submitted successfully.`,
        preview: `Your application for ${jobTitle} was submitted.`,
        subject: `Application submitted: ${jobTitle}`,
        title: "Your application was submitted.",
      });
    },
  },
  application_rejected: {
    category: "job_notifications",
    templateKey: "application_rejected",
    render: (data) =>
      renderNotificationEmail({
        data,
        eyebrow: "Application update",
        fallbackMessage: "Your application was not selected for the next stage.",
        preview: "There is an update to your application.",
        subject: "Application status update",
        title: "Your application status was updated.",
      }),
  },
  application_shortlisted: {
    category: "job_notifications",
    templateKey: "application_shortlisted",
    render: (data) =>
      renderNotificationEmail({
        data,
        eyebrow: "Application update",
        fallbackMessage: "Your application has been shortlisted.",
        preview: "Your application has been shortlisted.",
        subject: "Your application was shortlisted",
        title: "Your application was shortlisted.",
      }),
  },
  application_status_changed: {
    category: "job_notifications",
    templateKey: "application_status_changed",
    render: (data) =>
      renderNotificationEmail({
        data,
        eyebrow: "Application update",
        fallbackMessage: statusMessage(data),
        preview: "There is an update to your application.",
        subject: "Application status update",
        title: "Your application status was updated.",
      }),
  },
  interview_scheduled: {
    category: "job_notifications",
    templateKey: "interview_scheduled",
    render: (data) => {
      const interviewAt = textValue(data, "interviewAt");
      const timezone = textValue(data, "timezone", "UTC");
      const schedule = interviewAt
        ? `Your interview is scheduled for ${formatDateTime(interviewAt)} (${timezone}).`
        : "Your interview has been scheduled. Open JobForge to review the details.";

      return renderNotificationEmail({
        data: { ...data, message: textValue(data, "message", schedule) },
        eyebrow: "Interview scheduled",
        fallbackMessage: schedule,
        preview: "Your interview has been scheduled.",
        subject: "Interview scheduled",
        title: "Your interview is scheduled.",
      });
    },
  },
  interview_rescheduled: {
    category: "job_notifications",
    templateKey: "interview_rescheduled",
    render: (data) => {
      const interviewAt = textValue(data, "interviewAt");
      const timezone = textValue(data, "timezone", "UTC");
      const schedule = interviewAt
        ? `Your interview was rescheduled to ${formatDateTime(interviewAt)} (${timezone}).`
        : "Your interview was rescheduled. Open JobForge to review the new details.";

      return renderNotificationEmail({
        data: { ...data, message: textValue(data, "message", schedule) },
        eyebrow: "Interview rescheduled",
        fallbackMessage: schedule,
        preview: "Your interview was rescheduled.",
        subject: "Interview rescheduled",
        title: "Your interview was rescheduled.",
      });
    },
  },
  interview_cancelled: {
    category: "job_notifications",
    templateKey: "interview_cancelled",
    render: (data) =>
      renderNotificationEmail({
        data,
        eyebrow: "Interview cancelled",
        fallbackMessage: "Your interview was cancelled. Open JobForge to review the latest details.",
        preview: "Your interview was cancelled.",
        subject: "Interview cancelled",
        title: "Your interview was cancelled.",
      }),
  },
  new_applicant: {
    category: "job_notifications",
    templateKey: "new_applicant",
    render: (data) => {
      const jobTitle = textValue(data, "jobTitle", "your job");

      return renderNotificationEmail({
        data,
        eyebrow: "New applicant",
        fallbackMessage: `A new candidate applied for ${jobTitle}.`,
        preview: `A new candidate applied for ${jobTitle}.`,
        subject: `New applicant for ${jobTitle}`,
        title: "You received a new application.",
      });
    },
  },
  admin_message: {
    category: "admin_messages",
    templateKey: "admin_message",
    render: (data) =>
      renderNotificationEmail({
        data,
        eyebrow: "Platform message",
        fallbackMessage: "You have a new message from the JobForge team.",
        preview: "You have a new message from the JobForge team.",
        subject: textValue(data, "notificationTitle", "Message from JobForge"),
        title: textValue(data, "notificationTitle", "A message from JobForge"),
      }),
  },
  job_submitted: {
    category: "job_notifications",
    templateKey: "job_submitted",
    render: (data) => {
      const jobTitle = textValue(data, "jobTitle", "your job");
      const companyName = textValue(data, "companyName", "your company");

      return {
        subject: `Job submitted: ${jobTitle}`,
        text: templateText([
          `${jobTitle} at ${companyName} was submitted for review.`,
          "We will notify you when the job is published.",
        ]),
        html: renderLayout({
          body:
            paragraph(`${jobTitle} at ${companyName} was submitted for review.`) +
            `<div class="panel">${escapeHtml("We will notify you when the job is published.")}</div>`,
          eyebrow: "Job submitted",
          preview: `${jobTitle} was submitted for review.`,
          title: "Your job was submitted for review.",
        }),
      };
    },
  },
  job_scheduled: {
    category: "job_notifications",
    templateKey: "job_scheduled",
    render: (data) => {
      const jobTitle = textValue(data, "jobTitle", "your job");
      const publishAt = textValue(data, "publishAt");
      const scheduledTime = publishAt ? formatDateTime(publishAt) : "the selected time";

      return {
        subject: `Job scheduled: ${jobTitle}`,
        text: templateText([
          `${jobTitle} is scheduled to become public at ${scheduledTime} UTC.`,
          "The job will remain hidden until the scheduled publish time.",
        ]),
        html: renderLayout({
          body:
            paragraph(`${jobTitle} is scheduled to become public at ${scheduledTime} UTC.`) +
            `<div class="panel">${escapeHtml("The job will remain hidden until the scheduled publish time.")}</div>`,
          eyebrow: "Scheduled",
          preview: `${jobTitle} has a scheduled publish time.`,
          title: "Your job is scheduled.",
        }),
      };
    },
  },
  job_published: {
    category: "job_notifications",
    templateKey: "job_published",
    render: (data) => {
      const jobTitle = textValue(data, "jobTitle", "your job");
      const jobUrl = textValue(data, "jobUrl", `${siteUrl()}/jobs`);

      return {
        subject: `Job published: ${jobTitle}`,
        text: templateText([
          `${jobTitle} is now public on JobForge.`,
          jobUrl,
        ]),
        html: renderLayout({
          body:
            paragraph(`${jobTitle} is now public on JobForge.`) +
            actionLink("View Job", jobUrl),
          eyebrow: "Published",
          preview: `${jobTitle} is now public.`,
          title: "Your job is live.",
        }),
      };
    },
  },
  job_closed: {
    category: "job_notifications",
    templateKey: "job_closed",
    render: (data) => {
      const jobTitle = textValue(data, "jobTitle", "your job");

      return {
        subject: `Job closed: ${jobTitle}`,
        text: `${jobTitle} has been closed and is no longer accepting applications.`,
        html: renderLayout({
          body: paragraph(`${jobTitle} has been closed and is no longer accepting applications.`),
          eyebrow: "Closed",
          preview: `${jobTitle} has been closed.`,
          title: "Your job was closed.",
        }),
      };
    },
  },
  recruiter_account_notification: {
    category: "job_notifications",
    templateKey: "recruiter_account_notification",
    render: (data) => {
      const message = textValue(
        data,
        "message",
        "There is an update related to your recruiter account.",
      );

      return {
        subject: "Recruiter account update",
        text: message,
        html: renderLayout({
          body: paragraph(message),
          eyebrow: "Recruiter account",
          preview: "Recruiter account update.",
          title: "Recruiter account update",
        }),
      };
    },
  },
};

const eventTemplateMap: Record<EmailEventInput["type"], EmailTemplateKey> = {
  admin_message: "admin_message",
  account_created: "welcome",
  application_received: "new_applicant",
  application_status_changed: "application_status_changed",
  application_submitted: "application_submitted",
  application_withdrawn: "application_status_changed",
  interview_cancelled: "interview_cancelled",
  interview_rescheduled: "interview_rescheduled",
  interview_scheduled: "interview_scheduled",
  job_closed: "job_closed",
  job_published: "job_published",
  job_scheduled: "job_scheduled",
  job_submitted: "job_submitted",
  password_reset: "password_reset",
  recruiter_account_notification: "recruiter_account_notification",
  verify_email_requested: "verify_email",
};

export function renderEmailTemplate(event: EmailEventInput): RenderedEmail {
  const status = textValue(event.data ?? {}, "status").toLowerCase();
  const templateKey =
    event.type === "application_status_changed" && status === "shortlisted"
      ? "application_shortlisted"
      : event.type === "application_status_changed" && status === "rejected"
        ? "application_rejected"
        : eventTemplateMap[event.type];
  const template = templates[templateKey];
  const rendered = template.render(event.data ?? {});

  return {
    ...rendered,
    category: template.category,
    templateKey: template.templateKey,
  };
}
