"use client";

import Link from "next/link";
import { useState } from "react";
import {
  getApplicationStatusDisplay,
  getJobStatusDisplay,
  type DashboardActivityItem,
  type DashboardChartPoint,
  type DashboardJobPerformanceRow,
  type RecruiterAnalyticsData,
  type RecruiterAnalyticsTrendPoint,
} from "@/lib/dashboard-data";
import { loadRecruiterAnalyticsForRange } from "@/lib/dashboard-jobs";
import { DashboardSection, DashboardStatCard } from "./dashboard-widgets";

type AnalyticsPreset = "7" | "30" | "90" | "custom";
type SortDirection = "asc" | "desc";
type SortKey =
  | "applications"
  | "createdAt"
  | "title"
  | "updatedAt"
  | "views";

type SortState = {
  direction: SortDirection;
  key: SortKey;
};

const performancePageSize = 5;
const barHeightClasses = [
  "h-1",
  "h-3",
  "h-5",
  "h-8",
  "h-10",
  "h-14",
  "h-16",
  "h-20",
  "h-24",
  "h-28",
] as const;
const barWidthClasses = [
  "w-[6%]",
  "w-[10%]",
  "w-[18%]",
  "w-[26%]",
  "w-[34%]",
  "w-[42%]",
  "w-[52%]",
  "w-[64%]",
  "w-[78%]",
  "w-full",
] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function formatDate(value: string | null, fallback = "Not available") {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getRangeForPreset(preset: Exclude<AnalyticsPreset, "custom">) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (Number(preset) - 1));

  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10),
  };
}

function getScaledClass(
  value: number,
  maxValue: number,
  classes: readonly string[],
) {
  if (value <= 0 || maxValue <= 0) {
    return classes[0];
  }

  const index = Math.min(
    classes.length - 1,
    Math.max(1, Math.ceil((value / maxValue) * classes.length) - 1),
  );

  return classes[index];
}

function compareText(firstValue: string, secondValue: string) {
  return firstValue.localeCompare(secondValue, undefined, {
    sensitivity: "base",
  });
}

function compareDates(firstValue: string | null, secondValue: string | null) {
  const firstTime = firstValue ? new Date(firstValue).getTime() : 0;
  const secondTime = secondValue ? new Date(secondValue).getTime() : 0;

  return (Number.isFinite(firstTime) ? firstTime : 0) -
    (Number.isFinite(secondTime) ? secondTime : 0);
}

function sortPerformanceRows(
  rows: DashboardJobPerformanceRow[],
  sort: SortState,
) {
  return [...rows].sort((firstRow, secondRow) => {
    let result = 0;

    if (sort.key === "applications") {
      result = firstRow.applicationsCount - secondRow.applicationsCount;
    } else if (sort.key === "createdAt") {
      result = compareDates(firstRow.createdAt, secondRow.createdAt);
    } else if (sort.key === "updatedAt") {
      result = compareDates(firstRow.updatedAt, secondRow.updatedAt);
    } else if (sort.key === "views") {
      result = firstRow.viewsCount - secondRow.viewsCount;
    } else {
      result = compareText(firstRow.title, secondRow.title);
    }

    return sort.direction === "asc" ? result : -result;
  });
}

function SortButton({
  children,
  onSortChange,
  sort,
  sortKey,
}: {
  children: string;
  onSortChange: (sortKey: SortKey) => void;
  sort: SortState;
  sortKey: SortKey;
}) {
  const active = sort.key === sortKey;

  return (
    <button
      type="button"
      onClick={() => onSortChange(sortKey)}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-left text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors duration-200 hover:bg-yellow-50 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200"
    >
      <span>{children}</span>
      <span
        aria-hidden="true"
        className={active ? "text-yellow-600" : "text-gray-300"}
      >
        {active && sort.direction === "asc" ? "↑" : "↓"}
      </span>
    </button>
  );
}

function AnalyticsOverview({ analytics }: { analytics: RecruiterAnalyticsData }) {
  const stats = [
    ["active-jobs", "Active Jobs", analytics.summary.activeJobs, "Currently accepting applications."],
    ["draft-jobs", "Draft Jobs", analytics.summary.draftJobs, "Not yet published."],
    ["closed-jobs", "Closed Jobs", analytics.summary.closedJobs, "No longer accepting applications."],
    ["total-applications", "Total Applications", analytics.summary.totalApplications, "Across your recruiter-owned jobs."],
    ["new-applications", "New Applications", analytics.summary.newApplicationsLast7Days, "Received in the last 7 days."],
    ["scheduled-interviews", "Interviews Scheduled", analytics.summary.interviewsScheduled, "Currently on the calendar."],
    ["completed-interviews", "Interviews Completed", analytics.summary.interviewsCompleted, "Completed interview records."],
    ["hires", "Hires", analytics.summary.hires, "Applications marked hired."],
    ["rejections", "Rejections", analytics.summary.rejections, "Applications marked rejected."],
    ["offers", "Offers Sent", analytics.summary.offersSent, "Applications at the offer stage."],
  ] as const;

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {stats.map(([id, title, value, supportingText]) => (
        <DashboardStatCard
          key={id}
          supportingText={supportingText}
          title={title}
          value={formatNumber(value)}
        />
      ))}
    </div>
  );
}

function MiniBarChart({
  description,
  points,
  title,
}: {
  description: string;
  points: DashboardChartPoint[];
  title: string;
}) {
  const maxValue = Math.max(0, ...points.map((point) => point.value));

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5">
      <h3 className="text-base font-bold tracking-tight text-card-foreground">
        {title}
      </h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      {points.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No activity in this period.</p>
      ) : (
        <>
          <div
            aria-label={`${title}. Maximum value ${formatNumber(maxValue)}.`}
            className="mt-5 flex h-32 items-end gap-1"
            role="img"
          >
            {points.map((point) => (
              <div key={point.id} className="flex min-w-0 flex-1 items-end">
                <div
                  className={`w-full rounded-t-md bg-yellow-400/80 transition-all duration-200 ${getScaledClass(
                    point.value,
                    maxValue,
                    barHeightClasses,
                  )}`}
                  title={`${point.label}: ${formatNumber(point.value)}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span>{points[0]?.label ?? "Start"}</span>
            <span>{points[points.length - 1]?.label ?? "Today"}</span>
          </div>
        </>
      )}
    </div>
  );
}

function TrendCharts({ trend }: { trend: RecruiterAnalyticsTrendPoint[] }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      <MiniBarChart
        description="Applications received during the selected period."
        points={getVisibleTrendPoints(trend, "applications")}
        title="Applications Trend"
      />
      <MiniBarChart
        description="Non-cancelled interviews scheduled during the selected period."
        points={getVisibleTrendPoints(trend, "interviews")}
        title="Interview Trend"
      />
      <MiniBarChart
        description="Applications that reached the hired stage during the selected period."
        points={getVisibleTrendPoints(trend, "hires")}
        title="Hiring Trend"
      />
    </div>
  );
}

function Funnel({ analytics }: { analytics: RecruiterAnalyticsData }) {
  const maxValue = Math.max(0, ...analytics.charts.funnel.map((point) => point.value));

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-bold tracking-tight text-card-foreground">
        Application Funnel
      </h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Current application stages across your recruiter-owned jobs.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {analytics.charts.funnel.map((point) => {
          const status = getApplicationStatusDisplay(point.status);

          return (
            <div key={point.id} className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${status.className}`}
                >
                  {status.label}
                </span>
                <span className="text-lg font-bold text-card-foreground">
                  {formatNumber(point.value)}
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className={`h-full rounded-full bg-yellow-400 ${getScaledClass(
                    point.value,
                    maxValue,
                    barWidthClasses,
                  )}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Sources({ analytics }: { analytics: RecruiterAnalyticsData }) {
  if (analytics.sources.length === 0) {
    return null;
  }

  const maxValue = Math.max(0, ...analytics.sources.map((source) => source.value));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-bold tracking-tight text-card-foreground">
        Application Sources
      </h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Sources recorded on applications in the selected period.
      </p>
      <div className="mt-5 grid gap-3">
        {analytics.sources.map((source) => (
          <div key={source.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-card-foreground">{source.label}</span>
              <span className="font-bold text-card-foreground">{formatNumber(source.value)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full bg-yellow-400 ${getScaledClass(
                  source.value,
                  maxValue,
                  barWidthClasses,
                )}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Activity({ items }: { items: DashboardActivityItem[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-bold tracking-tight text-card-foreground">
        Recent Activity
      </h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Activity will appear as jobs and applications move through your hiring workflow.
        </p>
      ) : (
        <ol className="mt-5 space-y-4">
          {items.map((item) => (
            <li key={item.id} className="border-l-2 border-yellow-400 pl-4">
              <p className="text-sm font-bold text-card-foreground">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {formatDate(item.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Insights({ analytics }: { analytics: RecruiterAnalyticsData }) {
  const topJob = [...analytics.jobPerformance].sort(
    (first, second) => second.applicationsCount - first.applicationsCount,
  )[0];
  const awaitingReview = analytics.charts.funnel
    .filter((point) => point.status === "applied" || point.status === "reviewing")
    .reduce((total, point) => total + point.value, 0);
  const messages: string[] = [];

  if (analytics.summary.activeJobs === 0 && analytics.summary.draftJobs === 0) {
    messages.push("Post a job to start collecting recruiter analytics.");
  }
  if (topJob && topJob.applicationsCount > 0) {
    messages.push(
      `${topJob.title} receives the most applications (${formatNumber(topJob.applicationsCount)}).`,
    );
  }
  if (awaitingReview > 0) {
    messages.push(`${formatNumber(awaitingReview)} applicants are awaiting review.`);
  }
  if (analytics.summary.interviewsScheduled === 0) {
    messages.push("No interviews are currently scheduled.");
  }
  if (analytics.summary.totalApplications > 0 && analytics.summary.hires === 0) {
    messages.push("No hires have been recorded yet.");
  }
  if (analytics.summary.newApplicationsLast7Days > 0) {
    messages.push(
      `${formatNumber(analytics.summary.newApplicationsLast7Days)} new applications arrived in the last 7 days.`,
    );
  }

  if (messages.length === 0) {
    messages.push("More hiring activity will unlock additional insights.");
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5">
      <h3 className="text-base font-bold tracking-tight text-card-foreground">Quick Insights</h3>
      <ul className="mt-4 space-y-3">
        {messages.map((message) => (
          <li key={message} className="flex gap-3 text-sm leading-6 text-card-foreground">
            <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-yellow-400" />
            <span>{message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PerformanceTable({ analytics }: { analytics: RecruiterAnalyticsData }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({
    direction: "desc",
    key: "applications",
  });
  const sortedRows = sortPerformanceRows(analytics.jobPerformance, sort);
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / performancePageSize));
  const visibleRows = sortedRows.slice(
    (page - 1) * performancePageSize,
    page * performancePageSize,
  );

  function handleSortChange(sortKey: SortKey) {
    setPage(1);
    setSort((currentSort) => ({
      direction:
        currentSort.key === sortKey && currentSort.direction === "desc"
          ? "asc"
          : "desc",
      key: sortKey,
    }));
  }

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-base font-bold tracking-tight text-card-foreground">Job Performance</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Ranked recruiter-owned jobs with real application and view counts.
        </p>
      </div>
      {sortedRows.length === 0 ? (
        <div className="px-5 py-6 text-sm text-muted-foreground">
          No jobs are available for performance analysis. <Link className="font-semibold text-gray-900 underline" href="/post-job">Post a job</Link> to begin.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-3"><SortButton onSortChange={handleSortChange} sort={sort} sortKey="title">Job Title</SortButton></th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3"><SortButton onSortChange={handleSortChange} sort={sort} sortKey="views">Views</SortButton></th>
                  <th className="px-3 py-3"><SortButton onSortChange={handleSortChange} sort={sort} sortKey="applications">Applications</SortButton></th>
                  <th className="px-3 py-3"><SortButton onSortChange={handleSortChange} sort={sort} sortKey="createdAt">Created</SortButton></th>
                  <th className="px-3 py-3"><SortButton onSortChange={handleSortChange} sort={sort} sortKey="updatedAt">Updated</SortButton></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRows.map((row) => {
                  const status = getJobStatusDisplay(row.status);

                  return (
                    <tr key={row.id}>
                      <td className="max-w-64 px-5 py-4"><p className="break-words text-sm font-bold text-card-foreground">{row.title}</p></td>
                      <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${status.className}`}>{status.label}</span></td>
                      <td className="px-5 py-4 text-sm font-semibold text-card-foreground">{formatNumber(row.viewsCount)}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-card-foreground">{formatNumber(row.applicationsCount)}</td>
                      <td className="px-5 py-4 text-sm font-medium text-muted-foreground">{formatDate(row.createdAt)}</td>
                      <td className="px-5 py-4 text-sm font-medium text-muted-foreground">{formatDate(row.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-4 sm:flex-row">
            <p className="text-sm font-medium text-muted-foreground">Page {page} of {pageCount} / {sortedRows.length} jobs</p>
            <div className="flex gap-3">
              <button type="button" disabled={page <= 1} onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:bg-muted disabled:text-muted-foreground">Previous</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))} className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none">Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getVisibleTrendPoints(
  trend: RecruiterAnalyticsTrendPoint[],
  value: keyof Pick<RecruiterAnalyticsTrendPoint, "applications" | "hires" | "interviews">,
) {
  const points = trend.map((point) => ({
    date: point.date,
    id: `${value}-${point.date}`,
    label: point.label,
    value: point[value],
  }));

  if (points.length <= 30) {
    return points;
  }

  return points.filter((_, index) => index % Math.ceil(points.length / 30) === 0 || index === points.length - 1);
}

export default function RecruiterAnalytics({
  analytics,
}: {
  analytics: RecruiterAnalyticsData;
}) {
  const [visibleAnalytics, setVisibleAnalytics] = useState(analytics);
  const [preset, setPreset] = useState<AnalyticsPreset>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshAnalytics(dateFrom: string, dateTo: string) {
    setLoading(true);
    setError(null);
    const result = await loadRecruiterAnalyticsForRange({ dateFrom, dateTo });

    if (result.data) {
      setVisibleAnalytics(result.data);
    } else {
      setError(result.error ?? "Analytics are temporarily unavailable. Please try again.");
    }

    setLoading(false);
  }

  function handlePresetChange(nextPreset: AnalyticsPreset) {
    setPreset(nextPreset);

    if (nextPreset === "custom") {
      return;
    }

    const range = getRangeForPreset(nextPreset);
    void refreshAnalytics(range.dateFrom, range.dateTo);
  }

  function handleCustomApply() {
    if (!customFrom || !customTo || customFrom > customTo) {
      setError("Choose a valid custom date range before applying it.");
      return;
    }

    void refreshAnalytics(customFrom, customTo);
  }

  const trend = visibleAnalytics.charts.hiringTrend;
  const hasData =
    visibleAnalytics.jobPerformance.length > 0 ||
    visibleAnalytics.summary.totalApplications > 0 ||
    visibleAnalytics.summary.totalJobViews > 0;

  return (
    <DashboardSection
      description="Understand hiring activity, application flow, and job performance for your recruiter-owned jobs."
      loading={loading}
      title="Analytics & Insights"
    >
      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <label htmlFor="analytics-period" className="text-sm font-semibold text-card-foreground">Reporting period</label>
          <select id="analytics-period" value={preset} onChange={(event) => handlePresetChange(event.target.value as AnalyticsPreset)} className="mt-2 block h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-card-foreground outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-200 lg:w-56">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
        </div>
        {preset === "custom" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label htmlFor="analytics-from" className="text-sm font-semibold text-card-foreground">From</label>
              <input id="analytics-from" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-2 block h-11 rounded-xl border border-border bg-card px-3 text-sm text-card-foreground outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-200" />
            </div>
            <div>
              <label htmlFor="analytics-to" className="text-sm font-semibold text-card-foreground">To</label>
              <input id="analytics-to" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-2 block h-11 rounded-xl border border-border bg-card px-3 text-sm text-card-foreground outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-200" />
            </div>
            <button type="button" onClick={handleCustomApply} disabled={loading} className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Loading..." : "Apply"}</button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="mt-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => { const range = preset === "custom" ? { dateFrom: customFrom, dateTo: customTo } : getRangeForPreset(preset); if (range.dateFrom && range.dateTo) void refreshAnalytics(range.dateFrom, range.dateTo); }} className="font-semibold underline focus:outline-none focus:ring-4 focus:ring-red-200">Retry</button>
        </div>
      ) : null}

      {!hasData ? (
        <div className="mt-6 rounded-xl border border-border bg-muted/30 px-5 py-4 text-sm leading-6 text-muted-foreground">
          Analytics will appear once your jobs receive applications or public traffic. <Link className="font-semibold text-gray-900 underline" href="/post-job">Post a job</Link> to start your hiring pipeline.
        </div>
      ) : null}

      <AnalyticsOverview analytics={visibleAnalytics} />
      <Funnel analytics={visibleAnalytics} />
      <TrendCharts trend={trend} />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Sources analytics={visibleAnalytics} />
        <Insights analytics={visibleAnalytics} />
      </div>
      <PerformanceTable analytics={visibleAnalytics} />
      <div className="mt-6">
        <Activity items={visibleAnalytics.recentActivity} />
      </div>
    </DashboardSection>
  );
}
