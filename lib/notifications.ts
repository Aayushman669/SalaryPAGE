import type {
  NotificationSeverity,
  StoredNotificationType,
} from "@/lib/notification-types";

export type NotificationType = NotificationSeverity;

export type NotificationItem = {
  actionHref?: string;
  actionLabel?: string;
  createdAt: string;
  description: string;
  eventType: StoredNotificationType;
  id: string;
  read: boolean;
  title: string;
  type: NotificationType;
};

export type NotificationTypeDisplay = {
  className: string;
  iconLabel: string;
  iconText: string;
  label: string;
};

const notificationTypeDisplays: Record<NotificationType, NotificationTypeDisplay> = {
  info: {
    className: "border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
    iconLabel: "Information notification",
    iconText: "i",
    label: "Info",
  },
  success: {
    className: "border-yellow-300 bg-yellow-50 text-gray-900 dark:border-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-100",
    iconLabel: "Success notification",
    iconText: "OK",
    label: "Success",
  },
  system: {
    className: "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100",
    iconLabel: "System notification",
    iconText: "S",
    label: "System",
  },
  warning: {
    className: "border-yellow-400 bg-yellow-50 text-gray-900 dark:border-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-100",
    iconLabel: "Warning notification",
    iconText: "!",
    label: "Warning",
  },
};

const notificationEventDisplays: Partial<
  Record<StoredNotificationType, NotificationTypeDisplay>
> = {
  application_received: {
    className: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100",
    iconLabel: "Application notification",
    iconText: "A",
    label: "Application",
  },
  application_submitted: {
    className: "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/30 dark:text-green-100",
    iconLabel: "Application notification",
    iconText: "A",
    label: "Application",
  },
  application_status_changed: {
    className: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100",
    iconLabel: "Application status notification",
    iconText: "A",
    label: "Application update",
  },
  application_withdrawn: {
    className: "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-100",
    iconLabel: "Application withdrawal notification",
    iconText: "A",
    label: "Application withdrawn",
  },
  admin_message: {
    className: "border-purple-200 bg-purple-50 text-purple-900 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-100",
    iconLabel: "Admin message notification",
    iconText: "M",
    label: "Admin message",
  },
  interview_cancelled: {
    className: "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100",
    iconLabel: "Interview cancellation notification",
    iconText: "I",
    label: "Interview cancelled",
  },
  interview_completed: {
    className: "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/30 dark:text-green-100",
    iconLabel: "Completed interview notification",
    iconText: "I",
    label: "Interview completed",
  },
  interview_no_show: {
    className: "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-100",
    iconLabel: "Interview no-show notification",
    iconText: "I",
    label: "Interview no-show",
  },
  interview_rescheduled: {
    className: "border-yellow-300 bg-yellow-50 text-gray-900 dark:border-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-100",
    iconLabel: "Interview rescheduled notification",
    iconText: "I",
    label: "Interview rescheduled",
  },
  interview_scheduled: {
    className: "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/30 dark:text-green-100",
    iconLabel: "Interview scheduled notification",
    iconText: "I",
    label: "Interview scheduled",
  },
  job_closed: {
    className: "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100",
    iconLabel: "Job update notification",
    iconText: "J",
    label: "Job update",
  },
  job_published: {
    className: "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/30 dark:text-green-100",
    iconLabel: "Job update notification",
    iconText: "J",
    label: "Job published",
  },
};

export function getNotificationTypeDisplay(type: NotificationType) {
  return notificationTypeDisplays[type];
}

export function getNotificationEventDisplay(
  eventType: StoredNotificationType,
  severity: NotificationType,
) {
  return notificationEventDisplays[eventType] ?? notificationTypeDisplays[severity];
}

export function getUnreadNotificationCount(notifications: NotificationItem[]) {
  return notifications.filter((notification) => !notification.read).length;
}

export function formatUnreadNotificationCount(count: number) {
  if (count <= 0) {
    return "";
  }

  return count > 99 ? "99+" : String(count);
}

export function formatRelativeNotificationTime(
  createdAt: string,
  now = Date.now(),
) {
  const createdTime = new Date(createdAt).getTime();

  if (!Number.isFinite(createdTime)) {
    return "Recently";
  }

  const diffMs = Math.max(now - createdTime, 0);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(new Date(createdAt));
}
