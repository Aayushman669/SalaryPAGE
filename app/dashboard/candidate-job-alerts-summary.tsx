import Link from "next/link";
import { formatJobAlertSummary, type JobAlertsSummary } from "@/lib/job-alerts";

function formatDate(value: string | null) {
  if (!value) {
    return "Updated recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Updated recently";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function CandidateJobAlertsSummary({
  summary,
}: {
  summary: JobAlertsSummary;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-[0_18px_45px_rgba(17,24,39,0.08)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Job Alerts
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-card-foreground">
            Keep your search preferences ready
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {summary.totalCount} total alert{summary.totalCount === 1 ? "" : "s"}{" \u00b7 "}{summary.enabledCount} enabled
          </p>
        </div>
        <Link
          className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground transition-all duration-200 hover:border-accent hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          href="/job-alerts"
        >
          Manage Alerts
        </Link>
      </div>

      {summary.error ? (
        <div className="mt-6 rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
          Job Alerts are temporarily unavailable. You can manage them later from the Job Alerts page.
        </div>
      ) : null}

      {!summary.error && summary.recentAlerts.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted p-6 text-center">
          <p className="text-sm font-semibold text-card-foreground">No active alerts.</p>
          <Link
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200"
            href="/job-alerts"
          >
            Create Alert
          </Link>
        </div>
      ) : null}

      {!summary.error && summary.recentAlerts.length > 0 ? (
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {summary.recentAlerts.map((alert) => (
            <div className="min-w-0 rounded-xl border border-border bg-muted p-4" key={alert.id}>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-bold text-card-foreground" title={alert.alertName}>
                  {alert.alertName}
                </p>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {alert.enabled ? "On" : "Off"}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {formatJobAlertSummary(alert)}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {alert.frequency}{" \u00b7 "}{formatDate(alert.updatedAt ?? alert.createdAt)}
                </p>
                <Link
                  className="shrink-0 text-xs font-semibold text-card-foreground underline decoration-accent underline-offset-4 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                  href="/job-alerts"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
