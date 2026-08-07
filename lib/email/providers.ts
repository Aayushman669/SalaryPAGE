import "server-only";

import type {
  EmailMessage,
  EmailProvider,
  EmailSendResult,
  RenderedEmail,
} from "@/lib/email/types";

function getEmailFromAddress() {
  return process.env.EMAIL_FROM_ADDRESS ?? "JobForge <no-reply@example.com>";
}

function getEmailReplyTo() {
  return process.env.EMAIL_REPLY_TO_ADDRESS ?? null;
}

function parseAuthHeader() {
  const headerName = process.env.EMAIL_HTTP_AUTH_HEADER_NAME;
  const headerValue = process.env.EMAIL_HTTP_AUTH_HEADER_VALUE;

  if (!headerName || !headerValue) {
    return {};
  }

  return {
    [headerName]: headerValue,
  };
}

class MissingEmailProvider implements EmailProvider {
  id = "missing";

  async sendEmail(): Promise<EmailSendResult> {
    return {
      error:
        "Email provider is not configured. Set EMAIL_HTTP_ENDPOINT or plug in a provider adapter.",
      success: false,
    };
  }
}

class HttpEmailProvider implements EmailProvider {
  id = "http";

  constructor(private readonly endpoint: string) {}

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const response = await fetch(this.endpoint, {
        body: JSON.stringify(message),
        headers: {
          "Content-Type": "application/json",
          ...(message.idempotencyKey
            ? { "Idempotency-Key": message.idempotencyKey }
            : {}),
          ...parseAuthHeader(),
        },
        method: "POST",
      });

      if (!response.ok) {
        return {
          error: `Email provider returned ${response.status}.`,
          success: false,
        };
      }

      const body = (await response.json().catch(() => null)) as {
        id?: unknown;
        messageId?: unknown;
      } | null;

      return {
        providerMessageId:
          typeof body?.messageId === "string"
            ? body.messageId
            : typeof body?.id === "string"
              ? body.id
              : undefined,
        success: true,
      };
    } catch {
      return {
        error: "Email provider request failed.",
        success: false,
      };
    }
  }
}

export function createEmailProvider(): EmailProvider {
  const endpoint = process.env.EMAIL_HTTP_ENDPOINT;

  if (endpoint) {
    return new HttpEmailProvider(endpoint);
  }

  return new MissingEmailProvider();
}

export function createEmailMessage({
  idempotencyKey,
  rendered,
  to,
}: {
  idempotencyKey?: string;
  rendered: RenderedEmail;
  to: string;
}): EmailMessage {
  return {
    ...rendered,
    from: getEmailFromAddress(),
    idempotencyKey,
    replyTo: getEmailReplyTo(),
    to,
  };
}
