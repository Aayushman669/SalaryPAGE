export const notificationEventTypes = [
  "application_submitted",
  "application_received",
  "application_withdrawn",
  "application_status_changed",
  "interview_scheduled",
  "interview_rescheduled",
  "interview_cancelled",
  "interview_completed",
  "interview_no_show",
  "job_published",
  "job_closed",
  "admin_message",
] as const;

export type NotificationType = (typeof notificationEventTypes)[number];

export const notificationSeverities = [
  "success",
  "info",
  "warning",
  "system",
] as const;

export type NotificationSeverity = (typeof notificationSeverities)[number];
export type StoredNotificationType = NotificationType | "legacy";
export type NotificationMetadataValue = string | number | boolean | null;
export type NotificationMetadata = Record<string, NotificationMetadataValue>;

export type Notification = {
  createdAt: string;
  eventKey: string;
  eventType: StoredNotificationType;
  id: string;
  isRead: boolean;
  link: string | null;
  message: string;
  metadata: NotificationMetadata;
  readAt: string | null;
  severity: NotificationSeverity;
  title: string;
  userId: string;
};

export type NotificationCreationInput = {
  eventKey?: string;
  link?: string | null;
  message: string;
  metadata?: NotificationMetadata;
  recipientUserId: string;
  title: string;
  type: NotificationType;
};

export type NotificationCursor = {
  createdAt: string;
  id: string;
};

export type NotificationQuery = {
  cursor?: NotificationCursor | null;
  limit?: number;
};

export type NotificationQueryResult = {
  nextCursor: NotificationCursor | null;
  notifications: Notification[];
};

export type NotificationResult<T> = {
  data: T | null;
  error: string | null;
};

export type NotificationCreateResult = {
  created: boolean;
  notification: Notification | null;
};
