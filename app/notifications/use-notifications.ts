"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearUserNotifications,
  loadUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
  removeUserNotification,
  type NotificationListFilter,
} from "@/lib/notification-service";
import {
  formatUnreadNotificationCount,
  type NotificationItem,
} from "@/lib/notifications";
import type { NotificationCursor } from "@/lib/notification-types";

type UseNotificationsArgs = {
  enabled?: boolean;
  filter?: NotificationListFilter;
  limit?: number;
  search?: string;
  userId: string;
};

type UseNotificationsResult = {
  clearAll: () => Promise<void>;
  error: string | null;
  hasMore: boolean;
  isClearing: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isMarkingAllAsRead: boolean;
  markAllAsRead: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  notifications: NotificationItem[];
  pendingNotificationIds: string[];
  refresh: () => Promise<void>;
  remove: (notificationId: string) => Promise<void>;
  unreadBadgeLabel: string;
  unreadCount: number;
  loadMore: () => Promise<void>;
};

function getSafeError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useNotifications({
  enabled = true,
  filter = "all",
  limit = 20,
  search = "",
  userId,
}: UseNotificationsArgs): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<NotificationCursor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [pendingNotificationIds, setPendingNotificationIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const inFlightMoreRef = useRef(false);
  const inFlightIdsRef = useRef(new Set<string>());
  const normalizedSearch = search.trim();

  const load = useCallback(
    async (cursor: NotificationCursor | null, append: boolean) => {
      const requestId = ++requestIdRef.current;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      try {
        const page = await loadUserNotifications(userId, {
          cursor,
          filter,
          limit,
          search: normalizedSearch,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        setNotifications((current) =>
          append ? [...current, ...page.notifications] : page.notifications,
        );
        setNextCursor(page.nextCursor);
        setUnreadCount(page.unreadCount);
      } catch (loadError) {
        if (requestId === requestIdRef.current) {
          setError(getSafeError(loadError, "We could not load your notifications."));
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [filter, limit, normalizedSearch, userId],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void load(null, false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [enabled, load]);

  const refresh = useCallback(async () => {
    await load(null, false);
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore || inFlightMoreRef.current) {
      return;
    }

    inFlightMoreRef.current = true;
    try {
      await load(nextCursor, true);
    } finally {
      inFlightMoreRef.current = false;
    }
  }, [isLoadingMore, load, nextCursor]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (inFlightIdsRef.current.has(notificationId)) {
        return;
      }

      const notification = notifications.find((item) => item.id === notificationId);
      if (!notification || notification.read) {
        return;
      }

      inFlightIdsRef.current.add(notificationId);
      setPendingNotificationIds((current) => [...current, notificationId]);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, read: true } : item,
        ),
      );
      setUnreadCount((current) => Math.max(current - 1, 0));

      try {
        await markUserNotificationRead(userId, notificationId);
      } catch (markError) {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notificationId ? { ...item, read: false } : item,
          ),
        );
        setUnreadCount((current) => current + 1);
        setError(getSafeError(markError, "We could not update that notification."));
      } finally {
        inFlightIdsRef.current.delete(notificationId);
        setPendingNotificationIds((current) =>
          current.filter((id) => id !== notificationId),
        );
      }
    },
    [notifications, userId],
  );

  const markAllAsRead = useCallback(async () => {
    if (isMarkingAllAsRead || unreadCount === 0) {
      return;
    }

    const previous = notifications;
    setIsMarkingAllAsRead(true);
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);

    try {
      await markAllUserNotificationsRead(userId);
    } catch (markError) {
      setNotifications(previous);
      setUnreadCount(previous.filter((item) => !item.read).length);
      setError(getSafeError(markError, "We could not mark your notifications as read."));
    } finally {
      setIsMarkingAllAsRead(false);
    }
  }, [isMarkingAllAsRead, notifications, unreadCount, userId]);

  const remove = useCallback(
    async (notificationId: string) => {
      if (inFlightIdsRef.current.has(notificationId)) {
        return;
      }

      const notification = notifications.find((item) => item.id === notificationId);
      if (!notification) {
        return;
      }

      inFlightIdsRef.current.add(notificationId);
      setPendingNotificationIds((current) => [...current, notificationId]);
      setNotifications((current) => current.filter((item) => item.id !== notificationId));
      if (!notification.read) {
        setUnreadCount((current) => Math.max(current - 1, 0));
      }

      try {
        await removeUserNotification(userId, notificationId);
      } catch (removeError) {
        setNotifications((current) => [notification, ...current]);
        if (!notification.read) {
          setUnreadCount((current) => current + 1);
        }
        setError(getSafeError(removeError, "We could not remove that notification."));
      } finally {
        inFlightIdsRef.current.delete(notificationId);
        setPendingNotificationIds((current) =>
          current.filter((id) => id !== notificationId),
        );
      }
    },
    [notifications, userId],
  );

  const clearAll = useCallback(async () => {
    if (isClearing || notifications.length === 0) {
      return;
    }

    const previous = notifications;
    const previousUnreadCount = unreadCount;
    setIsClearing(true);
    setNotifications([]);
    setUnreadCount(0);

    try {
      await clearUserNotifications(userId);
    } catch (clearError) {
      setNotifications(previous);
      setUnreadCount(previousUnreadCount);
      setError(getSafeError(clearError, "We could not clear your notifications."));
    } finally {
      setIsClearing(false);
    }
  }, [isClearing, notifications, unreadCount, userId]);

  return {
    clearAll,
    error,
    hasMore: Boolean(nextCursor),
    isClearing,
    isLoading,
    isLoadingMore,
    isMarkingAllAsRead,
    loadMore,
    markAllAsRead,
    markAsRead,
    notifications,
    pendingNotificationIds,
    refresh,
    remove,
    unreadBadgeLabel: formatUnreadNotificationCount(unreadCount),
    unreadCount,
  };
}
