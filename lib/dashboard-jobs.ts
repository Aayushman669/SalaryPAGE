import { CONNECTION_ERROR_MESSAGE, logAuthError } from "@/lib/auth-errors";
import {
  calculateDashboardConversionRate,
  createEmptyRecruiterAnalyticsData,
  createEmptyRecruiterJobCounts,
  getApplicationStatusDisplay,
  getJobStatusDisplay,
  mapJobRowToDashboardJob,
  mapJobRowToDashboardPerformance,
  type DashboardActivityItem,
  type DashboardRecruiterApplication,
  type DashboardRecruiterInterview,
  normalizeDashboardJobStatus,
  type RecruiterApplicationDashboardData,
  type DashboardJobRow,
  type DashboardChartPoint,
  type RecruiterAnalyticsFunnelPoint,
  type RecruiterAnalyticsSource,
  type RecruiterAnalyticsTrendPoint,
  type RecruiterAnalyticsData,
  type RecruiterJobCounts,
  type RecruiterJobsDashboardInput,
} from "@/lib/dashboard-data";
import {
  isApplicationStatus,
  normalizeApplicationStatus,
} from "@/lib/applications";
import { supabase } from "@/lib/supabase";
import {
  canViewPremiumAnalytics,
  getSubscriptionSnapshot,
} from "@/lib/subscriptions";
import {
  applyRecruiterJobFilter,
  type RecruiterJobFilter,
} from "@/lib/recruiter-job-filters";

const recruiterJobSelectColumns =
  "id, title, company_name, status, created_at, updated_at, published_at, applications_count, views_count, location, employment_type, publish_at, slug";

const recruiterAnalyticsJobSelectColumns =
  "id, title, status, updated_at, published_at, applications_count, views_count, publish_at";

const recruiterJobCountKinds = [
  "published",
  "scheduled",
  "pending",
  "draft",
  "closed",
  "archived",
] as const;

type RecruiterJobCountKind = (typeof recruiterJobCountKinds)[number];

type LoadRecruiterDashboardJobsResult = {
  data: RecruiterJobsDashboardInput | null;
  error: string | null;
};

type DashboardMetricRow = {
  applications_count?: number | null;
  metric_date?: string | null;
  views_count?: number | null;
};

type DashboardAnalyticsJobRow = DashboardJobRow & {
  applications_count?: number | null;
  views_count?: number | null;
};

type RecruiterApplicationManagementRow = {
  applied_at?: string | null;
  candidate_avatar_url?: string | null;
  candidate_full_name?: string | null;
  candidate_id?: string | null;
  id?: string | null;
  job_id?: string | null;
  job_slug?: string | null;
  job_title?: string | null;
  status?: string | null;
};

type RecruiterUpcomingInterviewRow = {
  application_id?: string | null;
  candidate_full_name?: string | null;
  id?: string | null;
  interview_type?: string | null;
  job_slug?: string | null;
  job_title?: string | null;
  scheduled_end?: string | null;
  scheduled_start?: string | null;
  status?: string | null;
  timezone?: string | null;
};

function readErrorText(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const errorRecord = error as {
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    message?: unknown;
  };

  return [
    errorRecord.code,
    errorRecord.details,
    errorRecord.hint,
    errorRecord.message,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getFriendlyRecruiterJobsError(error: unknown) {
  const errorText = readErrorText(error);

  if (
    error instanceof TypeError ||
    errorText.includes("failed to fetch") ||
    errorText.includes("network") ||
    errorText.includes("timeout")
  ) {
    return CONNECTION_ERROR_MESSAGE;
  }

  if (
    errorText.includes("does not exist") ||
    errorText.includes("column") ||
    errorText.includes("relation")
  ) {
    return "Jobs storage is not ready yet. Please run the latest jobs migration in Supabase.";
  }

  if (
    errorText.includes("permission denied") ||
    errorText.includes("row-level security") ||
    errorText.includes("rls")
  ) {
    return "We could not load your jobs because the jobs table policy blocked access.";
  }

  return "We could not load your recruiter jobs. Please try again.";
}

function logAnalyticsFallback(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.warn(context, {
    errorText: readErrorText(error),
    error,
  });
}

async function countRecruiterJobsByKind({
  kind,
  nowIso,
  userId,
}: {
  kind: RecruiterJobCountKind;
  nowIso: string;
  userId: string;
}) {
  if (!supabase) {
    return {
      count: 0,
      error: "Supabase is not configured. Please check your environment variables.",
    };
  }

  let query = supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId);

  const filter: RecruiterJobFilter =
    kind === "published" ? "active" : kind;
  query = applyRecruiterJobFilter(query, filter, nowIso);

  const { count, error } = await query;

  if (error) {
    logAuthError(`[dashboard-jobs] ${kind} count failed`, error);

    return {
      count: 0,
      error: getFriendlyRecruiterJobsError(error),
    };
  }

  return {
    count: count ?? 0,
    error: null,
  };
}

async function fetchRecentRecruiterJobs(userId: string) {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      rows: [],
    };
  }

  const { data, error } = await supabase
    .from("jobs")
    .select(recruiterJobSelectColumns)
    .eq("created_by", userId)
    .order("created_at", {
    ascending: false,
    nullsFirst: false,
    })
    .limit(5);

  if (!error) {
    return {
      error: null,
      rows: (data ?? []) as DashboardJobRow[],
    };
  }

  logAuthError("[dashboard-jobs] recent jobs fetch failed", error);

  return {
    error: getFriendlyRecruiterJobsError(error),
    rows: [],
  };
}

function getFriendlyRecruiterApplicationsError(error: unknown) {
  const errorText = readErrorText(error);

  if (
    error instanceof TypeError ||
    errorText.includes("failed to fetch") ||
    errorText.includes("network") ||
    errorText.includes("timeout")
  ) {
    return CONNECTION_ERROR_MESSAGE;
  }

  return "We could not load your recent applications. Please try again.";
}

async function countRecruiterApplications(
  userId: string,
  status?: "interview" | "hired",
) {
  if (!supabase) {
    return {
      count: 0,
      error: "Supabase is not configured. Please check your environment variables.",
    };
  }

  let query = supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("recruiter_id", userId);

  if (status) {
    query = query.eq("status", status);
  }

  const { count, error } = await query;

  if (error) {
    logAuthError(
      `[dashboard-jobs] ${status ?? "total"} application count failed`,
      error,
    );

    return {
      count: 0,
      error: getFriendlyRecruiterApplicationsError(error),
    };
  }

  return {
    count: count ?? 0,
    error: null,
  };
}

async function countRecruiterScheduledInterviews() {
  if (!supabase) {
    return {
      count: 0,
      error: "Supabase is not configured. Please check your environment variables.",
    };
  }

  const { data, error } = await supabase.rpc(
    "count_recruiter_scheduled_interviews",
  );

  if (error) {
    logAuthError("[dashboard-jobs] interview count failed", error);
    return {
      count: 0,
      error: getFriendlyRecruiterApplicationsError(error),
    };
  }

  return { count: Number(data ?? 0), error: null };
}

async function fetchUpcomingRecruiterInterviews(): Promise<{
  error: string | null;
  rows: DashboardRecruiterInterview[];
}> {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      rows: [],
    };
  }

  const { data, error } = await supabase.rpc(
    "get_recruiter_upcoming_interviews",
    { p_limit: 3 },
  );

  if (error) {
    logAuthError("[dashboard-jobs] upcoming interviews fetch failed", error);
    return {
      error: "Upcoming interviews are temporarily unavailable.",
      rows: [],
    };
  }

  return {
    error: null,
    rows: ((data ?? []) as RecruiterUpcomingInterviewRow[]).flatMap((row) => {
      if (!row.id || !row.application_id || !row.scheduled_start || !row.scheduled_end) {
        return [];
      }

      return [{
        applicationId: row.application_id,
        candidateName: row.candidate_full_name?.trim() || "Unknown Candidate",
        id: row.id,
        interviewType: row.interview_type?.trim() || "Interview",
        jobSlug: row.job_slug?.trim() || "",
        jobTitle: row.job_title?.trim() || "Untitled role",
        scheduledEnd: row.scheduled_end,
        scheduledStart: row.scheduled_start,
        status: row.status?.trim() || "scheduled",
        timezone: row.timezone?.trim() || "UTC",
      }];
    }),
  };
}

function normalizeDashboardApplicationText(
  value: string | null | undefined,
  fallback: string,
) {
  return value?.trim() || fallback;
}

function mapRecruiterApplicationRow(
  row: RecruiterApplicationManagementRow,
): DashboardRecruiterApplication {
  return {
    appliedAt: row.applied_at ?? null,
    candidateAvatarUrl: row.candidate_avatar_url?.trim() || null,
    candidateId: normalizeDashboardApplicationText(
      row.candidate_id,
      "candidate",
    ),
    candidateName: normalizeDashboardApplicationText(
      row.candidate_full_name,
      "Unknown Candidate",
    ),
    id: normalizeDashboardApplicationText(row.id, "application"),
    jobId: normalizeDashboardApplicationText(row.job_id, "job"),
    jobSlug: normalizeDashboardApplicationText(row.job_slug, ""),
    jobTitle: normalizeDashboardApplicationText(row.job_title, "Unknown Job"),
    status: normalizeApplicationStatus(row.status),
  };
}

async function fetchRecentRecruiterApplications() {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      rows: [],
    };
  }

  const { data, error } = await supabase.rpc(
    "get_recruiter_application_management",
    {
      p_date_from: null,
      p_date_to: null,
      p_job_id: null,
      p_limit: 5,
      p_offset: 0,
      p_search: "",
      p_sort: "applied_desc",
      p_status: null,
    },
  );

  if (error) {
    logAuthError("[dashboard-jobs] recent applications fetch failed", error);

    return {
      error: getFriendlyRecruiterApplicationsError(error),
      rows: [],
    };
  }

  return {
    error: null,
    rows: (data ?? []) as RecruiterApplicationManagementRow[],
  };
}

async function loadRecruiterApplicationDashboard(
  userId: string,
): Promise<RecruiterApplicationDashboardData> {
  try {
    const [totalResult, interviewTableResult, hiredResult, recentResult, upcomingResult] =
      await Promise.all([
        countRecruiterApplications(userId),
        countRecruiterScheduledInterviews(),
        countRecruiterApplications(userId, "hired"),
        fetchRecentRecruiterApplications(),
        fetchUpcomingRecruiterInterviews(),
      ]);
    const interviewResult = interviewTableResult.error
      ? await countRecruiterApplications(userId, "interview")
      : interviewTableResult;
    const countError =
      totalResult.error ?? interviewResult.error ?? hiredResult.error;

    return {
      error: countError,
      hires: hiredResult.count,
      interviewsScheduled: interviewResult.count,
      upcomingInterviews: upcomingResult.rows,
      upcomingInterviewsError: upcomingResult.error,
      recentApplications: recentResult.rows.map(mapRecruiterApplicationRow),
      recentApplicationsError: recentResult.error,
      totalApplications: totalResult.count,
    };
  } catch (error) {
    logAuthError(
      "[dashboard-jobs] unexpected recruiter applications load failure",
      error,
    );

    return {
      error: getFriendlyRecruiterApplicationsError(error),
      hires: 0,
      interviewsScheduled: 0,
      upcomingInterviews: [],
      upcomingInterviewsError: getFriendlyRecruiterApplicationsError(error),
      recentApplications: [],
      recentApplicationsError: getFriendlyRecruiterApplicationsError(error),
      totalApplications: 0,
    };
  }
}

function buildCounts(
  countResults: Array<{
    count: number;
    error: string | null;
    status: RecruiterJobCountKind;
  }>,
) {
  const counts: RecruiterJobCounts = createEmptyRecruiterJobCounts();

  for (const result of countResults) {
    counts[result.status] = result.count;
  }

  return counts;
}

function safeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  return 0;
}

type AnalyticsRpcRecord = Record<string, unknown>;

function isAnalyticsRpcRecord(value: unknown): value is AnalyticsRpcRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readAnalyticsRpcRecord(
  value: unknown,
): AnalyticsRpcRecord | null {
  return isAnalyticsRpcRecord(value) ? value : null;
}

function readAnalyticsRpcRows(value: unknown) {
  return Array.isArray(value)
    ? value.filter(isAnalyticsRpcRecord)
    : [];
}

function readAnalyticsRpcString(
  record: AnalyticsRpcRecord,
  key: string,
) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readAnalyticsRpcDate(
  record: AnalyticsRpcRecord,
  key: string,
) {
  return readAnalyticsRpcString(record, key);
}

function parseRecruiterAnalyticsRpcData(
  value: unknown,
  counts: RecruiterJobCounts,
): RecruiterAnalyticsData | null {
  const payload = readAnalyticsRpcRecord(value);
  const summary = payload
    ? readAnalyticsRpcRecord(payload.summary)
    : null;

  if (!summary || !payload) {
    return null;
  }

  const trendRows = readAnalyticsRpcRows(payload.trend).flatMap(
    (row): RecruiterAnalyticsTrendPoint[] => {
      const date = readAnalyticsRpcString(row, "date");

      if (!date) {
        return [];
      }

      return [{
        applications: safeNumber(row.applications),
        date,
        hires: safeNumber(row.hires),
        interviews: safeNumber(row.interviews),
        label: readAnalyticsRpcString(row, "label") ?? date,
        views: safeNumber(row.views),
      }];
    },
  );
  const funnel = readAnalyticsRpcRows(payload.funnel).flatMap(
    (row): RecruiterAnalyticsFunnelPoint[] => {
      const rawStatus = readAnalyticsRpcString(row, "status");

      if (!rawStatus || !isApplicationStatus(rawStatus) || rawStatus === "withdrawn") {
        return [];
      }

      return [{
        id: readAnalyticsRpcString(row, "id") ?? `funnel-${rawStatus}`,
        label:
          readAnalyticsRpcString(row, "label") ??
          getApplicationStatusDisplay(rawStatus).label,
        status: rawStatus,
        value: safeNumber(row.value),
      }];
    },
  );
  const jobPerformance = readAnalyticsRpcRows(payload.jobPerformance).map(
    (row) =>
      mapJobRowToDashboardPerformance({
        applications_count: safeNumber(row.applicationsCount),
        created_at: readAnalyticsRpcDate(row, "createdAt"),
        id: readAnalyticsRpcString(row, "id"),
        published_at: readAnalyticsRpcDate(row, "publishedAt"),
        status: readAnalyticsRpcString(row, "status"),
        title: readAnalyticsRpcString(row, "title"),
        updated_at: readAnalyticsRpcDate(row, "updatedAt"),
        views_count: safeNumber(row.viewsCount),
      }),
  );
  const recentActivity = readAnalyticsRpcRows(payload.recentActivity).map(
    (row): DashboardActivityItem => ({
      createdAt: readAnalyticsRpcDate(row, "createdAt"),
      description: readAnalyticsRpcString(row, "description") ?? "",
      id: readAnalyticsRpcString(row, "id") ?? "activity",
      title: readAnalyticsRpcString(row, "title") ?? "Activity",
      type: readAnalyticsRpcString(row, "type") ?? "activity",
    }),
  );
  const sources = readAnalyticsRpcRows(payload.sources).flatMap(
    (row): RecruiterAnalyticsSource[] => {
      const label = readAnalyticsRpcString(row, "label");

      return label
        ? [{ label, value: safeNumber(row.value) }]
        : [];
    },
  );
  const jobStatusCounts = readAnalyticsRpcRows(payload.jobStatusCounts).flatMap(
    (row): DashboardChartPoint[] => {
      const rawStatus = readAnalyticsRpcString(row, "status");
      const status = normalizeDashboardJobStatus(rawStatus);

      if (status === "unknown") {
        return [];
      }

      return [{
        id: `status-${status}`,
        label: getJobStatusDisplay(status).label,
        status,
        value: safeNumber(row.value),
      }];
    },
  );

  return {
    charts: {
      applicationsLast30Days: trendRows.map((point) => ({
        date: point.date,
        id: `applications-${point.date}`,
        label: point.label,
        value: point.applications,
      })),
      funnel,
      hiringTrend: trendRows,
      jobsByStatus:
        jobStatusCounts.length > 0
          ? jobStatusCounts
          : buildStatusBreakdown(counts),
      viewsLast30Days: trendRows.map((point) => ({
        date: point.date,
        id: `views-${point.date}`,
        label: point.label,
        value: point.views,
      })),
    },
    jobPerformance,
    recentActivity,
    sources,
    summary: {
      activeJobs: safeNumber(summary.activeJobs),
      averageApplicationsPerJob: safeNumber(summary.averageApplicationsPerJob),
      closedJobs: safeNumber(summary.closedJobs),
      conversionRate: safeNumber(summary.conversionRate),
      draftJobs: safeNumber(summary.draftJobs),
      hires: safeNumber(summary.hires),
      interviewsCompleted: safeNumber(summary.interviewsCompleted),
      interviewsScheduled: safeNumber(summary.interviewsScheduled),
      newApplicationsLast7Days: safeNumber(summary.newApplicationsLast7Days),
      offersSent: safeNumber(summary.offersSent),
      rejections: safeNumber(summary.rejections),
      totalApplications: safeNumber(summary.totalApplications),
      totalJobViews: safeNumber(summary.totalJobViews),
    },
  };
}

function getMetricStartDate() {
  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - 29);

  return startDate;
}

function formatMetricDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createTrendPoints({
  metricRows,
  prefix,
  valueKey,
}: {
  metricRows: DashboardMetricRow[];
  prefix: "applications" | "views";
  valueKey: "applications_count" | "views_count";
}): DashboardChartPoint[] {
  const totalsByDate = new Map<string, number>();

  for (const row of metricRows) {
    if (!row.metric_date) {
      continue;
    }

    totalsByDate.set(
      row.metric_date,
      (totalsByDate.get(row.metric_date) ?? 0) + safeNumber(row[valueKey]),
    );
  }

  const startDate = getMetricStartDate();

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);
    const metricDate = formatMetricDay(date);

    return {
      date: metricDate,
      id: `${prefix}-${metricDate}`,
      label: new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
      }).format(date),
      value: totalsByDate.get(metricDate) ?? 0,
    };
  });
}

function buildStatusBreakdown(counts: RecruiterJobCounts): DashboardChartPoint[] {
  return recruiterJobCountKinds.map((status) => ({
    id: `status-${status}`,
    label: getJobStatusDisplay(status).label,
    status,
    value: counts[status],
  }));
}

async function fetchRecruiterAnalyticsJobs(userId: string) {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      rows: [],
    };
  }

  const { data, error } = await supabase
    .from("jobs")
    .select(recruiterAnalyticsJobSelectColumns)
    .eq("created_by", userId)
    .order("updated_at", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(250);

  if (error) {
    logAuthError("[dashboard-jobs] analytics jobs fetch failed", error);

    return {
      error: null,
      rows: [],
    };
  }

  return {
    error: null,
    rows: (data ?? []) as DashboardAnalyticsJobRow[],
  };
}

async function fetchRecruiterDailyMetrics(jobIds: string[]) {
  if (!supabase || jobIds.length === 0) {
    return {
      error: null,
      rows: [],
    };
  }

  const startDate = formatMetricDay(getMetricStartDate());
  const { data, error } = await supabase
    .from("job_daily_metrics")
    .select("metric_date, views_count, applications_count")
    .in("job_id", jobIds)
    .gte("metric_date", startDate);

  if (error) {
    logAnalyticsFallback(
      "[dashboard-jobs] daily metrics unavailable; using zero analytics",
      error,
    );

    return {
      error: null,
      rows: [],
    };
  }

  return {
    error: null,
    rows: (data ?? []) as DashboardMetricRow[],
  };
}

function buildRecruiterAnalytics({
  applicationDashboard,
  counts,
  metricRows,
  rows,
}: {
  applicationDashboard?: RecruiterApplicationDashboardData;
  counts: RecruiterJobCounts;
  metricRows: DashboardMetricRow[];
  rows: DashboardAnalyticsJobRow[];
}): RecruiterAnalyticsData {
  const totalJobViews = rows.reduce(
    (total, row) => total + safeNumber(row.views_count ?? row.viewsCount),
    0,
  );
  const totalApplications = rows.reduce(
    (total, row) =>
      total + safeNumber(row.applications_count ?? row.applicationsCount),
    0,
  );
  const averageApplicationsPerJob =
    rows.length > 0
      ? Math.round((totalApplications / rows.length) * 10) / 10
      : 0;
  const jobPerformance = rows.map(mapJobRowToDashboardPerformance);
  const applicationsLast30Days = createTrendPoints({
    metricRows,
    prefix: "applications",
    valueKey: "applications_count",
  });
  const viewsLast30Days = createTrendPoints({
    metricRows,
    prefix: "views",
    valueKey: "views_count",
  });
  const hiringTrend = applicationsLast30Days.map((point, index) => ({
    applications: point.value,
    date: point.date ?? point.id,
    hires: 0,
    interviews: 0,
    label: point.label,
    views: viewsLast30Days[index]?.value ?? 0,
  }));
  const emptyAnalytics = createEmptyRecruiterAnalyticsData();

  for (const row of rows) {
    const status = normalizeDashboardJobStatus(row.status, row.publish_at);

    if (status === "unknown" && process.env.NODE_ENV === "development") {
      console.warn("[dashboard-jobs] analytics row has unknown status", {
        id: row.id,
        status: row.status,
      });
    }
  }

  return {
    charts: {
      applicationsLast30Days,
      funnel: emptyAnalytics.charts.funnel,
      hiringTrend,
      jobsByStatus: buildStatusBreakdown(counts),
      viewsLast30Days,
    },
    jobPerformance,
    recentActivity: [],
    sources: [],
    summary: {
      activeJobs: counts.published,
      averageApplicationsPerJob,
      closedJobs: counts.closed,
      conversionRate: calculateDashboardConversionRate({
        applications: totalApplications,
        views: totalJobViews,
      }),
      draftJobs: counts.draft,
      hires: applicationDashboard?.hires ?? 0,
      interviewsCompleted: 0,
      interviewsScheduled: applicationDashboard?.interviewsScheduled ?? 0,
      newApplicationsLast7Days: 0,
      offersSent: 0,
      rejections: 0,
      totalApplications,
      totalJobViews,
    },
  };
}

async function loadRecruiterAnalytics({
  applicationDashboard,
  counts,
  dateFrom = null,
  dateTo = null,
  userId,
}: {
  applicationDashboard?: RecruiterApplicationDashboardData;
  counts: RecruiterJobCounts;
  dateFrom?: string | null;
  dateTo?: string | null;
  userId: string;
}) {
  if (supabase) {
    const { data, error } = await supabase.rpc("get_recruiter_analytics", {
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (!error) {
      const analytics = parseRecruiterAnalyticsRpcData(data, counts);

      if (analytics) {
        return {
          analytics,
          error: null,
        };
      }
    } else {
      logAnalyticsFallback(
        "[dashboard-jobs] aggregate recruiter analytics unavailable; using legacy analytics",
        error,
      );
    }
  }

  const analyticsJobsResult = await fetchRecruiterAnalyticsJobs(userId);

  if (analyticsJobsResult.error) {
    return {
      analytics: createEmptyRecruiterAnalyticsData(),
      error: null,
    };
  }

  const jobIds = analyticsJobsResult.rows
    .map((job) => job.id)
    .filter((jobId): jobId is string => Boolean(jobId));
  const metricsResult = await fetchRecruiterDailyMetrics(jobIds);

  if (metricsResult.error) {
    return {
      analytics: buildRecruiterAnalytics({
        applicationDashboard,
        counts,
        metricRows: [],
        rows: analyticsJobsResult.rows,
      }),
      error: null,
    };
  }

  return {
    analytics: buildRecruiterAnalytics({
      applicationDashboard,
      counts,
      metricRows: metricsResult.rows,
      rows: analyticsJobsResult.rows,
    }),
    error: null,
  };
}

export async function loadRecruiterAnalyticsForRange({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}): Promise<{ data: RecruiterAnalyticsData | null; error: string | null }> {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase is not configured. Please check your environment variables.",
    };
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return {
        data: null,
        error: "Your session has expired. Please sign in again.",
      };
    }

    const { data, error } = await supabase.rpc("get_recruiter_analytics", {
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });

    if (error) {
      logAnalyticsFallback(
        "[dashboard-jobs] recruiter analytics range load failed",
        error,
      );

      return {
        data: null,
        error: "Analytics are temporarily unavailable. Please try again.",
      };
    }

    const analytics = parseRecruiterAnalyticsRpcData(
      data,
      createEmptyRecruiterJobCounts(),
    );

    return analytics
      ? { data: analytics, error: null }
      : {
          data: null,
          error: "Analytics are temporarily unavailable. Please try again.",
        };
  } catch (error) {
    logAuthError("[dashboard-jobs] unexpected recruiter analytics range failure", error);

    return {
      data: null,
      error: "Analytics are temporarily unavailable. Please try again.",
    };
  }
}

export async function loadRecruiterDashboardJobs(
  userId: string,
): Promise<LoadRecruiterDashboardJobsResult> {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase is not configured. Please check your environment variables.",
    };
  }

  try {
    const subscriptionResult = await getSubscriptionSnapshot();

    if (subscriptionResult.error || !subscriptionResult.snapshot) {
      return {
        data: null,
        error:
          subscriptionResult.error ??
          "We could not load your subscription details. Please try again.",
      };
    }

    const nowIso = new Date().toISOString();
    const [recentJobsResult, applicationDashboard, ...countResults] =
      await Promise.all([
      fetchRecentRecruiterJobs(userId),
      loadRecruiterApplicationDashboard(userId),
      ...recruiterJobCountKinds.map(async (status) => ({
        ...(await countRecruiterJobsByKind({ kind: status, nowIso, userId })),
        status,
      })),
      ]);
    const firstCountError = countResults.find((result) => result.error)?.error;

    if (recentJobsResult.error || firstCountError) {
      return {
        data: null,
        error: recentJobsResult.error ?? firstCountError ?? null,
      };
    }

    const counts = buildCounts(countResults);
    const analyticsResult = canViewPremiumAnalytics(
      subscriptionResult.snapshot,
    ).allowed
      ? await loadRecruiterAnalytics({
          applicationDashboard,
          counts,
          userId,
        })
      : {
          analytics: createEmptyRecruiterAnalyticsData(),
          error: null,
        };

    if (analyticsResult.error || !analyticsResult.analytics) {
      return {
        data: null,
        error: analyticsResult.error,
      };
    }

    return {
      data: {
        applicationDashboard,
        analytics: analyticsResult.analytics,
        counts,
        recentJobs: recentJobsResult.rows.map(mapJobRowToDashboardJob),
        subscription: subscriptionResult.snapshot,
      },
      error: null,
    };
  } catch (error) {
    logAuthError("[dashboard-jobs] unexpected recruiter jobs load failure", error);

    return {
      data: null,
      error: getFriendlyRecruiterJobsError(error),
    };
  }
}
