import type {
  NotificationCursor,
  NotificationSeverity,
  StoredNotificationType,
} from "@/lib/notification-types";
import type { NotificationItem } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

export type NotificationListFilter = "all" | "read" | "unread";

export type NotificationListQuery = {
  cursor?: NotificationCursor | null;
  filter?: NotificationListFilter;
  limit?: number;
  search?: string;
};

export type NotificationPage = {
  unreadCount: number;
  nextCursor: NotificationCursor | null;
  notifications: NotificationItem[];
};

type NotificationRow = {
  action_href?: string | null;
  action_label?: string | null;
  created_at?: string | null;
  description?: string | null;
  event_type?: string | null;
  id?: string | null;
  read_at?: string | null;
  title?: string | null;
  type?: string | null;
};

const defaultLimit = 20;
const maxLimit = 50;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeInternalLinkPattern = /^\/(?!\/)/;
const notificationEventTypes = new Set<StoredNotificationType>([
  "application_received",
  "application_status_changed",
  "application_submitted",
  "application_withdrawn",
  "interview_cancelled",
  "interview_completed",
  "interview_no_show",
  "interview_rescheduled",
  "interview_scheduled",
  "job_closed",
  "job_published",
  "admin_message",
  "legacy",
]);
const notificationSeverities = new Set<NotificationSeverity>([
  "info",
  "success",
  "system",
  "warning",
]);

function safeErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("jwt") || message.includes("auth") || message.includes("session")) {
    return "Your session expired. Please sign in again.";
  }

  if (message.includes("network") || message.includes("fetch")) {
    return "We could not connect. Please try again.";
  }

  return fallback;
}

function normalizeLimit(limit: number | undefined) {
  if (!Number.isInteger(limit)) {
    return defaultLimit;
  }

  return Math.min(Math.max(limit as number, 1), maxLimit);
}

function normalizeSearch(search: string | undefined) {
  return (search ?? "")
    .replace(/[%(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function isValidCursor(cursor: NotificationCursor | null | undefined) {
  return Boolean(
    cursor &&
      uuidPattern.test(cursor.id) &&
      Number.isFinite(Date.parse(cursor.createdAt)),
  );
}

function isSafeInternalLink(value: string | null | undefined) {
  return !value || (value.length <= 500 && safeInternalLinkPattern.test(value));
}

function mapNotificationRow(row: NotificationRow): NotificationItem | null {
  const eventType = notificationEventTypes.has(row.event_type as StoredNotificationType)
    ? (row.event_type as StoredNotificationType)
    : "legacy";
  const severity = row.type as NotificationSeverity;

  if (
    !row.id ||
    !row.created_at ||
    !row.title ||
    !row.description ||
    !notificationSeverities.has(severity) ||
    !isSafeInternalLink(row.action_href)
  ) {
    return null;
  }

  return {
    actionHref: row.action_href ?? undefined,
    actionLabel: row.action_label ?? undefined,
    createdAt: row.created_at,
    description: row.description,
    eventType,
    id: row.id,
    read: Boolean(row.read_at),
    title: row.title,
    type: severity,
  };
}

async function getCurrentUserId(expectedUserId: string) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.getUser();
  const currentUserId = data.user?.id;

  if (error || !currentUserId) {
    throw new Error("Your session expired. Please sign in again.");
  }

  if (currentUserId !== expectedUserId) {
    throw new Error("Only your own notifications can be changed.");
  }

  return currentUserId;
}

export async function loadUserNotifications(
  userId: string,
  query: NotificationListQuery = {},
): Promise<NotificationPage> {
  const currentUserId = await getCurrentUserId(userId);
  const limit = normalizeLimit(query.limit);
  const search = normalizeSearch(query.search);
  const filter = query.filter ?? "all";

  try {
    let listQuery = supabase!
      .from("user_notifications")
      .select(
        "id, event_type, type, title, description, action_label, action_href, read_at, created_at",
      )
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (filter === "unread") {
      listQuery = listQuery.is("read_at", null);
    } else if (filter === "read") {
      listQuery = listQuery.not("read_at", "is", null);
    }

    const hasCursor = isValidCursor(query.cursor);
    const searchCondition = search
      ? `or(title.ilike.%${search}%,description.ilike.%${search}%)`
      : null;
    const cursorCondition = hasCursor
      ? `or(created_at.lt.${query.cursor?.createdAt},and(created_at.eq.${query.cursor?.createdAt},id.lt.${query.cursor?.id}))`
      : null;

    if (searchCondition && cursorCondition) {
      listQuery = listQuery.or(`and(${searchCondition},${cursorCondition})`);
    } else if (searchCondition) {
      listQuery = listQuery.or(searchCondition.slice(3, -1));
    } else if (cursorCondition) {
      listQuery = listQuery.or(cursorCondition.slice(3, -1));
    }

    const unreadQuery = supabase!
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUserId)
      .is("read_at", null);

    const [{ data, error }, { count, error: unreadError }] = await Promise.all([
      listQuery,
      unreadQuery,
    ]);

    if (error || unreadError) {
      throw error ?? unreadError;
    }

    const rows = ((data ?? []) as NotificationRow[])
      .map(mapNotificationRow)
      .filter((item): item is NotificationItem => Boolean(item));
    const hasMore = rows.length > limit;
    const notifications = hasMore ? rows.slice(0, limit) : rows;
    const last = notifications[notifications.length - 1];

    return {
      nextCursor:
        hasMore && last
          ? { createdAt: last.createdAt, id: last.id }
          : null,
      notifications,
      unreadCount: count ?? 0,
    };
  } catch (error) {
    throw new Error(
      safeErrorMessage(error, "We could not load your notifications."),
    );
  }
}

export async function markUserNotificationRead(
  userId: string,
  notificationId: string,
) {
  const currentUserId = await getCurrentUserId(userId);

  try {
    const { error } = await supabase!
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", currentUserId);

    if (error) {
      throw error;
    }
  } catch (error) {
    throw new Error(safeErrorMessage(error, "We could not update that notification."));
  }
}

export async function markAllUserNotificationsRead(userId: string) {
  const currentUserId = await getCurrentUserId(userId);

  try {
    const { error } = await supabase!
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", currentUserId)
      .is("read_at", null);

    if (error) {
      throw error;
    }
  } catch (error) {
    throw new Error(safeErrorMessage(error, "We could not mark your notifications as read."));
  }
}

export async function removeUserNotification(
  userId: string,
  notificationId: string,
) {
  const currentUserId = await getCurrentUserId(userId);

  try {
    const { error } = await supabase!
      .from("user_notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", currentUserId);

    if (error) {
      throw error;
    }
  } catch (error) {
    throw new Error(safeErrorMessage(error, "We could not remove that notification."));
  }
}

export async function clearUserNotifications(userId: string) {
  const currentUserId = await getCurrentUserId(userId);

  try {
    const { error } = await supabase!
      .from("user_notifications")
      .delete()
      .eq("user_id", currentUserId);

    if (error) {
      throw error;
    }
  } catch (error) {
    throw new Error(safeErrorMessage(error, "We could not clear your notifications."));
  }
}
