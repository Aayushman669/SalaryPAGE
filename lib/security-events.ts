import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const securityEventTypes = [
  "payment_verification_succeeded",
  "payment_verification_failed",
  "subscription_activation_failed",
  "webhook_signature_failed",
  "webhook_replay_detected",
  "webhook_processing_failed",
  "webhook_processed",
  "rate_limit_exceeded",
  "role_changed",
  "job_deleted",
  "payment_status_changed",
] as const;

export type SecurityEventType = (typeof securityEventTypes)[number];
export type SecurityEventSeverity = "info" | "warning" | "critical";

type SafeMetadataValue = string | number | boolean | null;

export type SecurityEventInput = {
  actorId?: string | null;
  eventType: SecurityEventType;
  metadata?: Record<string, SafeMetadataValue>;
  severity: SecurityEventSeverity;
  targetId?: string | null;
  targetType?: string | null;
};

function sanitizeMetadata(metadata: Record<string, SafeMetadataValue> | undefined) {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => /^[a-z][a-z0-9_]{0,48}$/.test(key))
      .slice(0, 20)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.slice(0, 240) : value,
      ]),
  );
}

export async function recordSecurityEvent(input: SecurityEventInput) {
  try {
    const metadata = sanitizeMetadata(input.metadata);
    const log = input.severity === "info" ? console.info : console.warn;

    log("[security-event]", {
      eventType: input.eventType,
      severity: input.severity,
    });

    const database = createSupabaseAdminClient();

    if (!database) {
      return;
    }

    const { error } = await database.from("security_audit_events").insert({
      actor_id: input.actorId ?? null,
      event_type: input.eventType,
      metadata,
      severity: input.severity,
      target_id: input.targetId ?? null,
      target_type: input.targetType ?? null,
    });

    if (error) {
      console.error("[security-event] audit write failed", {
        code: error.code,
        eventType: input.eventType,
      });
    }
  } catch {
    console.error("[security-event] audit write failed", {
      eventType: input.eventType,
    });
  }
}
