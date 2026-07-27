"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { formatUnreadNotificationCount } from "@/lib/notifications";
import NotificationCard from "./notification-card";
import { useNotifications } from "./use-notifications";

type NotificationCenterProps = {
  userId: string;
};

const focusableSelector =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function BellIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M15 17H9m10-1.5c-.9-.8-1.5-1.8-1.5-3.1V10a5.5 5.5 0 0 0-11 0v2.4c0 1.3-.6 2.3-1.5 3.1-.5.4-.2 1.5.5 1.5h13c.7 0 1-1.1.5-1.5ZM9.8 20a2.4 2.4 0 0 0 4.4 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function NotificationSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex gap-3 rounded-xl border border-border bg-card p-4">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-muted" />
          <div className="grid min-w-0 flex-1 gap-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationCenter({ userId }: NotificationCenterProps) {
  const panelTitleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const bellButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const {
    clearAll,
    error,
    hasMore,
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
    unreadCount,
  } = useNotifications({ limit: 8, userId });

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousFocusRef.current = document.activeElement;
    const focusId = window.setTimeout(() => panelRef.current?.focus(), 0);

    function getFocusableElements() {
      return Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => !element.hasAttribute("disabled"));
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    function handlePointerDown(event: MouseEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (
        panelRef.current?.contains(event.target) ||
        bellButtonRef.current?.contains(event.target)
      ) {
        return;
      }

      closePanel();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.clearTimeout(focusId);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [closePanel, isOpen]);

  function handleBellKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
    }
  }

  const badgeLabel = formatUnreadNotificationCount(unreadCount);

  return (
    <div className="relative">
      <button
        ref={bellButtonRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : "Open notifications"}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        onKeyDown={handleBellKeyDown}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-colors hover:border-yellow-300 hover:bg-accent/10 focus:outline-none focus:ring-4 focus:ring-yellow-200"
      >
        <BellIcon />
        {badgeLabel ? (
          <span className="absolute -right-2 -top-2 min-w-5 rounded-full border border-card bg-yellow-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-gray-900 shadow-sm">
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={panelTitleId}
          tabIndex={-1}
          className="fixed inset-x-4 top-20 z-50 max-h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl outline-none sm:absolute sm:inset-auto sm:right-0 sm:top-14 sm:w-[390px]"
        >
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Notification Center
                </p>
                <h2 id={panelTitleId} className="mt-1 text-xl font-bold tracking-tight">
                  Notifications
                </h2>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close notifications"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-sm font-bold text-muted-foreground transition-colors hover:border-yellow-300 hover:text-card-foreground focus:outline-none focus:ring-4 focus:ring-yellow-100"
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                disabled={unreadCount === 0 || isMarkingAllAsRead || isClearing}
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-xs font-semibold transition-colors hover:border-yellow-300 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-yellow-100"
              >
                {isMarkingAllAsRead ? "Updating..." : "Mark all as read"}
              </button>
              <button
                type="button"
                onClick={() => void clearAll()}
                disabled={notifications.length === 0 || isClearing || isMarkingAllAsRead}
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-yellow-300 hover:text-card-foreground disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-yellow-100"
              >
                {isClearing ? "Clearing..." : "Clear all"}
              </button>
              <Link
                href="/notifications"
                onClick={closePanel}
                className="ml-auto rounded-lg px-2 py-1 text-xs font-bold text-yellow-700 underline-offset-4 hover:underline focus:outline-none focus:ring-4 focus:ring-yellow-100 dark:text-yellow-300"
              >
                View all
              </Link>
            </div>
          </div>

          <div className="max-h-[56vh] overflow-y-auto px-4 py-4">
            {isLoading ? <NotificationSkeleton /> : null}
            {!isLoading && error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">
                <p>{error}</p>
                <button type="button" onClick={() => void refresh()} className="mt-3 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-300">
                  Retry
                </button>
              </div>
            ) : null}
            {!isLoading && !error && notifications.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-5 py-8 text-center">
                <p className="text-base font-bold">You&apos;re all caught up</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">New notifications will appear here.</p>
              </div>
            ) : null}
            {!isLoading && !error && notifications.length > 0 ? (
              <div className="grid gap-3">
                {notifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onClose={closePanel}
                    onMarkAsRead={markAsRead}
                    onRemove={remove}
                    pending={pendingNotificationIds.includes(notification.id)}
                  />
                ))}
                {hasMore ? (
                  <button type="button" disabled={isLoadingMore} onClick={() => void loadMore()} className="min-h-10 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:border-yellow-300 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-yellow-100">
                    {isLoadingMore ? "Loading more..." : "Load more"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
