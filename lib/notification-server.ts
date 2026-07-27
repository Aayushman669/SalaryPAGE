import "server-only";

import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  notificationEventTypes,
  notificationSeverities,
  type Notification,
  type NotificationCreateResult,
  type NotificationCreationInput,
  type NotificationCursor,
  type NotificationMetadata,
  type NotificationQuery,
  type NotificationQueryResult,
  type NotificationResult,
  type NotificationSeverity,
  type StoredNotificationType,
} from "@/lib/notification-types";

const defaultNotificationLimit = 25;
const maxNotificationLimit = 50;
const internalLinkPattern = /^\/(?!\/)/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const metadataKeyPattern = /^[a-z][a-z0-9_]{0,63}$/;
const sensitiveMetadataKeyPattern = /(password|secret|token|refresh|access|cookie|authorization|email|phone|resume|internal|note)/i;

const notificationColumns =
  "id, user_id, event_type, type, title, description, action_href, event_key, metadata, read_at, created_at";

type NotificationRow = {
  action_href: string | null;
  created_at: string;
  description: string;
  event_key: string;
  event_type: string;
  id: string;
  metadata: unknown;
  read_at: string | null;
  title: string;
  type: string;
  user_id: string;
};

type AdministratorNotificationInput = Omit<
  NotificationCreationInput,
  "recipientUserId"
>;

function logNotificationError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  if (error && typeof error === "object") {
    const record = error as {
      code?: unknown;
      message?: unknown;
      status?: unknown;
    };
    console.error(context, {
      code: record.code,
      message: record.message,
      status: record.status,
    });
    return;
  }

  console.error(context, { type: typeof error });
}

function resultError<T>(error: string): NotificationResult<T> {
  return { data: null, error };
}

function isValidUserId(value: string) {
  return uuidPattern.test(value);
}

function normalizePlainText(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (
    !normalized ||
    normalized.length > maxLength ||
    /[<>]/.test(normalized) ||
    /javascript\s*:/i.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function validateLink(value: string | null | undefined) {
  if (value === undefined || value === null || value.trim() === "") {
    return { value: null, error: null };
  }

  const link = value.trim();

  if (
    link.length > 500 ||
    !internalLinkPattern.test(link) ||
    /[\u0000-\u001f]/.test(link)
  ) {
    return {
      value: null,
      error: "Notification links must be safe internal paths.",
    };
  }

  return { value: link, error: null };
}

function validateMetadata(
  metadata: NotificationMetadata | undefined,
): NotificationResult<NotificationMetadata> {
  if (!metadata) {
    return { data: {}, error: null };
  }

  const entries = Object.entries(metadata);

  if (entries.length > 20) {
    return resultError("Notification metadata contains too many fields.");
  }

  const normalized: NotificationMetadata = {};

  for (const [key, value] of entries) {
    if (
      !metadataKeyPattern.test(key) ||
      sensitiveMetadataKeyPattern.test(key)
    ) {
      return resultError("Notification metadata contains an unsafe field.");
    }

    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      return resultError("Notification metadata must contain safe values.");
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
      return resultError("Notification metadata contains an invalid number.");
    }

    if (typeof value === "string" && value.length > 500) {
      return resultError("Notification metadata contains an oversized value.");
    }

    normalized[key] = value;
  }

  return { data: normalized, error: null };
}

function isNotificationSeverity(value: string): value is NotificationSeverity {
  return notificationSeverities.includes(value as NotificationSeverity);
}

function isStoredNotificationType(value: string): value is StoredNotificationType {
  return value === "legacy" || notificationEventTypes.includes(value as (typeof notificationEventTypes)[number]);
}

function parseMetadata(value: unknown): NotificationMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const metadata: NotificationMetadata = {};

  for (const [key, item] of Object.entries(value)) {
    if (
      metadataKeyPattern.test(key) &&
      !sensitiveMetadataKeyPattern.test(key) &&
      (item === null ||
        typeof item === "string" ||
        typeof item === "boolean" ||
        (typeof item === "number" && Number.isFinite(item)))
    ) {
      metadata[key] = item;
    }
  }

  return metadata;
}

function mapNotificationRow(row: NotificationRow): Notification | null {
  if (
    !row.id ||
    !isValidUserId(row.user_id) ||
    !row.created_at ||
    !row.event_key ||
    !row.title ||
    !row.description ||
    !isNotificationSeverity(row.type) ||
    !isStoredNotificationType(row.event_type)
  ) {
    return null;
  }

  return {
    createdAt: row.created_at,
    eventKey: row.event_key,
    eventType: row.event_type,
    id: row.id,
    isRead: Boolean(row.read_at),
    link: row.action_href,
    message: row.description,
    metadata: parseMetadata(row.metadata),
    readAt: row.read_at,
    severity: row.type,
    title: row.title,
    userId: row.user_id,
  };
}

function getNotificationLimit(limit: number | undefined) {
  if (limit === undefined) {
    return defaultNotificationLimit;
  }

  return Number.isInteger(limit)
    ? Math.min(Math.max(limit, 1), maxNotificationLimit)
    : defaultNotificationLimit;
}

function validateCursor(cursor: NotificationCursor | null | undefined) {
  if (!cursor) {
    return null;
  }

  return cursor.id && uuidPattern.test(cursor.id) && Number.isFinite(Date.parse(cursor.createdAt))
    ? cursor
    : null;
}

function getSeverity(type: NotificationCreationInput["type"]): NotificationSeverity {
  if (type === "job_published") {
    return "success";
  }

  if (type === "job_closed" || type === "interview_cancelled") {
    return "warning";
  }

  if (type === "admin_message") {
    return "system";
  }

  return "info";
}

function validateCreationInput(input: NotificationCreationInput): NotificationResult<{
  eventKey: string;
  link: string | null;
  message: string;
  metadata: NotificationMetadata;
  recipientUserId: string;
  title: string;
}> {
  if (!isValidUserId(input.recipientUserId)) {
    return resultError("Notification recipient is invalid.");
  }

  if (!notificationEventTypes.includes(input.type)) {
    return resultError("Notification type is invalid.");
  }

  const title = normalizePlainText(input.title, 160);
  const message = normalizePlainText(input.message, 1000);

  if (!title || !message) {
    return resultError("Notification title and message are required.");
  }

  const linkResult = validateLink(input.link);
  if (linkResult.error) {
    return resultError(linkResult.error);
  }

  const metadataResult = validateMetadata(input.metadata);
  if (metadataResult.error || !metadataResult.data) {
    return resultError(metadataResult.error ?? "Notification metadata is invalid.");
  }

  const eventKey = input.eventKey?.trim() || `${input.type}:${randomUUID()}`;

  if (
    eventKey.length > 240 ||
    !eventKey ||
    /[\u0000-\u001f]/.test(eventKey)
  ) {
    return resultError("Notification event key is invalid.");
  }

  return {
    data: {
      eventKey,
      link: linkResult.value,
      message,
      metadata: metadataResult.data,
      recipientUserId: input.recipientUserId,
      title,
    },
    error: null,
  };
}

function getUnavailableResult<T>() {
  return resultError<T>("Notifications are temporarily unavailable.");
}

function isAdministratorRole(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const role = (value as { role?: unknown }).role;
  return role === "admin" || role === "super_admin";
}

export async function createNotification(
  input: NotificationCreationInput,
): Promise<NotificationResult<NotificationCreateResult>> {
  const validation = validateCreationInput(input);

  if (validation.error || !validation.data) {
    return resultError(validation.error ?? "Notification is invalid.");
  }

  const database = createSupabaseAdminClient();

  if (!database) {
    return getUnavailableResult();
  }

  const { data, error } = await database
    .from("user_notifications")
    .insert({
      action_href: validation.data.link,
      description: validation.data.message,
      event_key: validation.data.eventKey,
      event_type: input.type,
      metadata: validation.data.metadata,
      title: validation.data.title,
      type: getSeverity(input.type),
      user_id: validation.data.recipientUserId,
    })
    .select(notificationColumns)
    .maybeSingle();

  if (!error && data) {
    const notification = mapNotificationRow(data as NotificationRow);
    return notification
      ? { data: { created: true, notification }, error: null }
      : resultError("Notification could not be read after creation.");
  }

  if (!error && !data) {
    return { data: { created: false, notification: null }, error: null };
  }

  if (error?.code === "23505") {
    const existing = await database
      .from("user_notifications")
      .select(notificationColumns)
      .eq("event_key", validation.data.eventKey)
      .eq("user_id", validation.data.recipientUserId)
      .maybeSingle();

    if (!existing.error) {
      return {
        data: {
          created: false,
          notification: existing.data
            ? mapNotificationRow(existing.data as NotificationRow)
            : null,
        },
        error: null,
      };
    }
  }

  logNotificationError("[notifications] create failed", error);
  return getUnavailableResult();
}

export async function notifyAdministrators(
  input: AdministratorNotificationInput,
): Promise<NotificationResult<{ notified: number }>> {
  const eventKey = input.eventKey?.trim();

  if (!eventKey) {
    return resultError("Administrator notifications require an event key.");
  }

  const database = createSupabaseAdminClient();
  if (!database) {
    return getUnavailableResult();
  }

  const { data: users, error: usersError } = await database.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (usersError) {
    logNotificationError("[notifications] administrator lookup failed", usersError);
    return getUnavailableResult();
  }

  const administratorIds = users.users
    .filter((user) => isAdministratorRole(user.app_metadata))
    .map((user) => user.id)
    .filter(isValidUserId);

  if (administratorIds.length === 0) {
    return { data: { notified: 0 }, error: null };
  }

  const { data: profiles, error: profilesError } = await database
    .from("profiles")
    .select("id")
    .in("id", administratorIds);

  if (profilesError) {
    logNotificationError("[notifications] administrator profile lookup failed", profilesError);
    return getUnavailableResult();
  }

  const profileIds = new Set(
    (profiles ?? [])
      .map((profile) => profile.id)
      .filter((id): id is string => typeof id === "string" && isValidUserId(id)),
  );

  let notified = 0;

  for (const recipientUserId of administratorIds) {
    if (!profileIds.has(recipientUserId)) {
      continue;
    }

    const result = await createNotification({
      ...input,
      eventKey: `${eventKey}:${recipientUserId}`,
      recipientUserId,
    });

    if (!result.error && result.data?.created) {
      notified += 1;
    }
  }

  return { data: { notified }, error: null };
}

export async function listUserNotifications(
  userId: string,
  query: NotificationQuery = {},
): Promise<NotificationResult<NotificationQueryResult>> {
  if (!isValidUserId(userId)) {
    return resultError("Notification owner is invalid.");
  }

  const database = createSupabaseAdminClient();
  if (!database) {
    return getUnavailableResult();
  }

  const limit = getNotificationLimit(query.limit);
  const cursor = validateCursor(query.cursor);
  let request = database
    .from("user_notifications")
    .select(notificationColumns)
    .eq("user_id", userId);

  if (query.cursor && !cursor) {
    return resultError("Notification cursor is invalid.");
  }

  if (cursor) {
    request = request.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await request
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (error) {
    logNotificationError("[notifications] list failed", error);
    return getUnavailableResult();
  }

  const rows = ((data ?? []) as NotificationRow[])
    .map(mapNotificationRow)
    .filter((item): item is Notification => Boolean(item));
  const hasMore = rows.length > limit;
  const notifications = rows.slice(0, limit);
  const last = notifications.at(-1);

  return {
    data: {
      nextCursor: hasMore && last
        ? { createdAt: last.createdAt, id: last.id }
        : null,
      notifications,
    },
    error: null,
  };
}

export async function getUnreadNotificationCount(
  userId: string,
): Promise<NotificationResult<number>> {
  if (!isValidUserId(userId)) {
    return resultError("Notification owner is invalid.");
  }

  const database = createSupabaseAdminClient();
  if (!database) {
    return getUnavailableResult();
  }

  const { count, error } = await database
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    logNotificationError("[notifications] unread count failed", error);
    return getUnavailableResult();
  }

  return { data: count ?? 0, error: null };
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
): Promise<NotificationResult<boolean>> {
  if (!isValidUserId(userId) || !uuidPattern.test(notificationId)) {
    return resultError("Notification is invalid.");
  }

  const database = createSupabaseAdminClient();
  if (!database) {
    return getUnavailableResult();
  }

  const { error } = await database
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    logNotificationError("[notifications] mark read failed", error);
    return getUnavailableResult();
  }

  return { data: true, error: null };
}

export async function markAllNotificationsAsRead(
  userId: string,
): Promise<NotificationResult<boolean>> {
  if (!isValidUserId(userId)) {
    return resultError("Notification owner is invalid.");
  }

  const database = createSupabaseAdminClient();
  if (!database) {
    return getUnavailableResult();
  }

  const { error } = await database
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    logNotificationError("[notifications] mark all read failed", error);
    return getUnavailableResult();
  }

  return { data: true, error: null };
}

export async function deleteNotification(
  userId: string,
  notificationId: string,
): Promise<NotificationResult<boolean>> {
  if (!isValidUserId(userId) || !uuidPattern.test(notificationId)) {
    return resultError("Notification is invalid.");
  }

  const database = createSupabaseAdminClient();
  if (!database) {
    return getUnavailableResult();
  }

  const { error } = await database
    .from("user_notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    logNotificationError("[notifications] delete failed", error);
    return getUnavailableResult();
  }

  return { data: true, error: null };
}
