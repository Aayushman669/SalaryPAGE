"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/auth-context";
import { showInfoToast } from "@/lib/toast";
import { useNotifications } from "./use-notifications";

const notificationPollIntervalMs = 30_000;

function getSafeNotificationHref(href?: string) {
  return href && href.startsWith("/") && !href.startsWith("//")
    ? href
    : "/notifications";
}

export default function NotificationAutoToast() {
  const { getCurrentUser, isAuthLoading, isLoggedIn } = useAuth();
  const [userId, setUserId] = useState("");
  const [identityReady, setIdentityReady] = useState(false);
  const seenNotificationIdsRef = useRef(new Set<string>());
  const initializedUserIdRef = useRef<string | null>(null);
  const {
    isLoading: notificationsLoading,
    notifications: notificationItems,
    refresh: refreshNotifications,
  } = useNotifications({
    enabled: identityReady && Boolean(userId),
    limit: 20,
    userId,
  });

  useEffect(() => {
    let isMounted = true;

    if (isAuthLoading || !isLoggedIn) {
      const resetId = window.setTimeout(() => {
        setUserId("");
        setIdentityReady(false);
        seenNotificationIdsRef.current.clear();
        initializedUserIdRef.current = null;
      }, 0);

      return () => {
        window.clearTimeout(resetId);
        isMounted = false;
      };
    }

    const identityResetId = window.setTimeout(() => {
      setIdentityReady(false);
    }, 0);

    void getCurrentUser().then((user) => {
      if (!isMounted) {
        return;
      }

      setUserId(user?.id ?? "");
      setIdentityReady(true);
    });

    return () => {
      window.clearTimeout(identityResetId);
      isMounted = false;
    };
  }, [getCurrentUser, isAuthLoading, isLoggedIn]);

  useEffect(() => {
    if (!identityReady || !userId || notificationsLoading) {
      return;
    }

    if (initializedUserIdRef.current !== userId) {
      seenNotificationIdsRef.current = new Set(
        notificationItems.map((notification) => notification.id),
      );
      initializedUserIdRef.current = userId;
      return;
    }

    for (const notification of notificationItems) {
      if (
        notification.read ||
        seenNotificationIdsRef.current.has(notification.id)
      ) {
        continue;
      }

      seenNotificationIdsRef.current.add(notification.id);
      showInfoToast(notification.title, notification.description, {
        action: {
          label: "View",
          onClick: () => {
            window.location.assign(
              getSafeNotificationHref(notification.actionHref),
            );
          },
        },
        duration: 7000,
        id: `notification:${notification.id}`,
      });
    }
  }, [identityReady, notificationItems, notificationsLoading, userId]);

  useEffect(() => {
    if (!identityReady || !userId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshNotifications();
    }, notificationPollIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [identityReady, refreshNotifications, userId]);

  return null;
}
