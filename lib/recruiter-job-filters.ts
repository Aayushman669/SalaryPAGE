export const recruiterJobFilterValues = [
  "all",
  "active",
  "scheduled",
  "draft",
  "pending",
  "closed",
  "expired",
  "archived",
] as const;

export const recruiterJobCreatedFilterValues = [
  "all",
  "today",
  "seven_days",
  "thirty_days",
  "ninety_days",
] as const;

export const recruiterJobSortValues = [
  "newest",
  "oldest",
  "applications",
  "updated",
  "alphabetical",
] as const;

export type RecruiterJobFilter = (typeof recruiterJobFilterValues)[number];
export type RecruiterJobCreatedFilter =
  (typeof recruiterJobCreatedFilterValues)[number];
export type RecruiterJobSort = (typeof recruiterJobSortValues)[number];

type RecruiterJobQuery<TQuery> = {
  eq(column: string, value: string): TQuery;
  gte(column: string, value: string): TQuery;
  gt(column: string, value: string): TQuery;
  lte(column: string, value: string): TQuery;
  not(column: string, operator: string, value: string | null): TQuery;
  or(filters: string): TQuery;
};

export function normalizeRecruiterJobCreatedFilter(
  value: string | null | undefined,
): RecruiterJobCreatedFilter {
  return recruiterJobCreatedFilterValues.includes(
    value as RecruiterJobCreatedFilter,
  )
    ? (value as RecruiterJobCreatedFilter)
    : "all";
}

export function normalizeRecruiterJobSort(
  value: string | null | undefined,
): RecruiterJobSort {
  return recruiterJobSortValues.includes(value as RecruiterJobSort)
    ? (value as RecruiterJobSort)
    : "newest";
}

export function getRecruiterJobCreatedFilterLabel(
  filter: RecruiterJobCreatedFilter,
) {
  const labels: Record<RecruiterJobCreatedFilter, string> = {
    all: "Any time",
    ninety_days: "Last 90 days",
    seven_days: "Last 7 days",
    thirty_days: "Last 30 days",
    today: "Today",
  };

  return labels[filter];
}

export function getRecruiterJobSortLabel(sort: RecruiterJobSort) {
  const labels: Record<RecruiterJobSort, string> = {
    alphabetical: "Alphabetical",
    applications: "Most applications",
    newest: "Newest",
    oldest: "Oldest",
    updated: "Recently updated",
  };

  return labels[sort];
}

export function getRecruiterJobCreatedAfter(
  filter: RecruiterJobCreatedFilter,
  now = Date.now(),
) {
  const daysByFilter: Partial<Record<RecruiterJobCreatedFilter, number>> = {
    ninety_days: 90,
    seven_days: 7,
    thirty_days: 30,
  };

  if (filter === "today") {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  }

  const days = daysByFilter[filter];
  return days ? new Date(now - days * 24 * 60 * 60 * 1000).toISOString() : null;
}

export function isRecruiterJobFilter(
  value: string | null | undefined,
): value is RecruiterJobFilter {
  return recruiterJobFilterValues.includes(value as RecruiterJobFilter);
}

export function normalizeRecruiterJobFilter(
  value: string | null | undefined,
): RecruiterJobFilter {
  return isRecruiterJobFilter(value) ? value : "all";
}

export function getRecruiterJobFilterLabel(filter: RecruiterJobFilter) {
  const labels: Record<RecruiterJobFilter, string> = {
    active: "Active jobs",
    all: "All jobs",
    archived: "Archived jobs",
    closed: "Closed jobs",
    draft: "Draft jobs",
    expired: "Expired jobs",
    pending: "Legacy pending jobs",
    scheduled: "Scheduled jobs",
  };

  return labels[filter];
}

export function applyRecruiterJobFilter<TQuery extends RecruiterJobQuery<TQuery>>(
  query: TQuery,
  filter: RecruiterJobFilter,
  nowIso: string,
) {
  if (filter === "active") {
    return query
      .eq("status", "published")
      .eq("moderation_status", "active")
      .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  }

  if (filter === "scheduled") {
    return query
      .eq("status", "published")
      .eq("moderation_status", "active")
      .gt("publish_at", nowIso)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  }

  if (filter === "expired") {
    return query
      .eq("status", "published")
      .not("expires_at", "is", null)
      .lte("expires_at", nowIso);
  }

  if (filter === "all") {
    return query;
  }

  return query.eq("status", filter);
}
