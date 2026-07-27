"use client";

import Link from "next/link";
import {
  formatRelativeNotificationTime,
  getNotificationEventDisplay,
  type NotificationItem,
} from "@/lib/notifications";

type NotificationCardProps = {
  notification: NotificationItem;
  onClose?: () => void;
  onMarkAsRead: (notificationId: string) => void;
  onRemove: (notificationId: string) => void;
  pending?: boolean;
};

function NotificationEventIcon({ notification }: { notification: NotificationItem }) {
  const display = getNotificationEventDisplay(notification.eventType, notification.type);

  return (
    <span
      aria-label={display.iconLabel}
      role="img"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-black ${display.className}`}
      title={display.label}
    >
      {display.iconText}
    </span>
  );
}

export default function NotificationCard({
  notification,
  onClose,
  onMarkAsRead,
  onRemove,
  pending = false,
}: NotificationCardProps) {
  const display = getNotificationEventDisplay(notification.eventType, notification.type);

  return (
    <article
      className={`rounded-xl border p-4 transition-colors duration-200 ${
        notification.read
          ? "border-border bg-card"
          : "border-yellow-300 bg-yellow-50/60 dark:border-yellow-700 dark:bg-yellow-950/20"
      }`}
    >
      <div className="flex gap-3">
        <NotificationEventIcon notification={notification} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-bold text-card-foreground">
                {notification.title}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {display.label} &middot; {formatRelativeNotificationTime(notification.createdAt)}
              </p>
            </div>
            {!notification.read ? (
              <span className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-yellow-500">
                <span className="sr-only">Unread</span>
              </span>
            ) : null}
          </div>

          <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
            {notification.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {notification.actionHref && notification.actionLabel ? (
              <Link
                href={notification.actionHref}
                onClick={() => {
                  onMarkAsRead(notification.id);
                  onClose?.();
                }}
                className="inline-flex min-h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-yellow-200"
              >
                {notification.actionLabel}
              </Link>
            ) : null}
            {!notification.read ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void onMarkAsRead(notification.id)}
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground transition-colors hover:border-yellow-300 hover:bg-accent/10 focus:outline-none focus:ring-4 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Updating..." : "Mark read"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => void onRemove(notification.id)}
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-yellow-300 hover:text-card-foreground focus:outline-none focus:ring-4 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Updating..." : "Remove"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
