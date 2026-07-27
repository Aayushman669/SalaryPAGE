import Link from "next/link";
import type { ReactNode } from "react";
import ApplicationStatusBadge from "@/app/applications/application-status-badge";
import CandidateAvatar from "@/app/applications/candidate-avatar";
import {
  formatInterviewDateTime,
  getInterviewTypeLabel,
} from "@/lib/interviews";
import {
  dashboardEmptyStates,
  getJobStatusDisplay,
  type DashboardBadge,
  type DashboardEmptyStateData,
  type DashboardEmptyStateVariant,
  type DashboardJobSummary,
  type DashboardRecruiterApplication,
  type DashboardRecruiterInterview,
  type DashboardQuickActionItem,
  type DashboardStat,
  type DashboardStatValue,
} from "@/lib/dashboard-data";

type DashboardStatCardProps = {
  ariaLabel?: string;
  badge?: DashboardBadge;
  disabled?: boolean;
  formatValue?: (value: DashboardStatValue) => ReactNode;
  href?: string;
  icon?: ReactNode;
  iconLabel?: string;
  loading?: boolean;
  supportingText?: string;
  title: string;
  value: DashboardStatValue;
};

type DashboardSectionProps = {
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  description?: string;
  headerHidden?: boolean;
  loading?: boolean;
  surface?: "card" | "plain";
  title: string;
};

type DashboardEmptyStateProps = {
  actionHref?: string;
  actionLabel?: string;
  description?: string;
  disabled?: boolean;
  title?: string;
  variant: DashboardEmptyStateVariant;
};

type DashboardQuickActionProps = {
  badge?: DashboardBadge;
  description: string;
  disabled?: boolean;
  href?: string;
  icon?: ReactNode;
  iconLabel?: string;
  title: string;
  variant?: DashboardQuickActionItem["variant"];
};

const emptyStateDefaults: Record<
  DashboardEmptyStateVariant,
  Pick<DashboardEmptyStateData, "description" | "title">
> = {
  activity: dashboardEmptyStates.activity,
  applications: dashboardEmptyStates.applications,
  jobs: dashboardEmptyStates.jobs,
  recommendations: dashboardEmptyStates.recommendations,
  "saved-jobs": dashboardEmptyStates.savedJobs,
};

function DashboardBadgePill({ badge }: { badge?: DashboardBadge }) {
  if (!badge) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
        badge.className ?? "border-yellow-300 bg-yellow-50 text-gray-900"
      }`}
      title={badge.description}
    >
      {badge.label}
    </span>
  );
}

function renderStatValue(
  value: DashboardStatValue,
  formatValue?: (value: DashboardStatValue) => ReactNode,
) {
  return formatValue ? formatValue(value) : value;
}

function getStatCardAccent(title: string) {
  const normalizedTitle = title.toLowerCase();

  if (normalizedTitle.includes("active") || normalizedTitle.includes("saved")) {
    return "border-l-4 border-l-yellow-500";
  }

  if (normalizedTitle.includes("scheduled") || normalizedTitle.includes("profile")) {
    return "border-l-4 border-l-yellow-400";
  }

  if (normalizedTitle.includes("pending") || normalizedTitle.includes("application")) {
    return "border-l-4 border-l-gray-400";
  }

  if (normalizedTitle.includes("draft") || normalizedTitle.includes("interview")) {
    return "border-l-4 border-l-gray-500";
  }

  return "border-l-4 border-l-yellow-300";
}

function formatDashboardDate(value: string | null) {
  if (!value) {
    return "Date not available";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date not available";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function StatCardBody({
  badge,
  disabled,
  formatValue,
  icon,
  iconLabel,
  loading,
  supportingText,
  title,
  value,
}: DashboardStatCardProps) {
  return (
    <article
      aria-busy={loading ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
      className={`relative rounded-xl border border-border bg-muted p-6 shadow-[0_18px_45px_rgba(17,24,39,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(17,24,39,0.11)] ${getStatCardAccent(title)} ${
        disabled ? "opacity-60" : ""
      }`}
    >
      {loading ? (
        <div className="animate-pulse">
          <div className="h-4 w-24 rounded-full bg-gray-100" />
          <div className="mt-7 h-10 w-20 rounded-xl bg-gray-100" />
        </div>
      ) : (
        <>
          {badge ? (
            <div className="absolute -top-3 right-4 z-10">
              <DashboardBadgePill badge={badge} />
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-sm font-semibold leading-5 text-muted-foreground">
                {title}
              </p>
              {supportingText ? (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {supportingText}
                </p>
              ) : null}
            </div>
            {icon ? (
              <span aria-label={iconLabel} aria-hidden={iconLabel ? undefined : true}>
                {icon}
              </span>
            ) : null}
          </div>
          <p className="mt-4 break-words text-4xl font-bold capitalize tracking-tight text-card-foreground">
            {renderStatValue(value, formatValue)}
          </p>
        </>
      )}
    </article>
  );
}

export function DashboardStatCard(props: DashboardStatCardProps) {
  if (props.href && !props.disabled) {
    return (
      <Link
        href={props.href}
        aria-label={props.ariaLabel ?? props.title}
        className="block rounded-xl focus:outline-none focus:ring-4 focus:ring-yellow-200"
      >
        <StatCardBody {...props} />
      </Link>
    );
  }

  return <StatCardBody {...props} />;
}

export function DashboardStatWidget({ stat }: { stat: DashboardStat }) {
  return (
    <DashboardStatCard
      ariaLabel={`${stat.title}. ${stat.supportingText ?? "View details"}`}
      badge={stat.badge}
      disabled={stat.disabled}
      href={stat.href}
      loading={stat.loading}
      supportingText={stat.supportingText}
      title={stat.title}
      value={stat.value}
    />
  );
}

export function DashboardSection({
  actionHref,
  actionLabel,
  children,
  description,
  headerHidden = false,
  loading,
  surface = "card",
  title,
}: DashboardSectionProps) {
  const header = (
    <div className={headerHidden ? "sr-only" : ""}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-card-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );

  if (surface === "plain") {
    return (
      <section aria-busy={loading ? "true" : undefined}>
        {header}
        {children}
      </section>
    );
  }

  return (
    <section
      aria-busy={loading ? "true" : undefined}
    className="rounded-xl border border-border bg-card p-6 shadow-[0_18px_45px_rgba(17,24,39,0.08)] sm:p-8"
    >
      {header}
      {children}
    </section>
  );
}

export function DashboardEmptyState({
  actionHref,
  actionLabel,
  description,
  disabled,
  title,
  variant,
}: DashboardEmptyStateProps) {
  const fallback = emptyStateDefaults[variant];
  const resolvedTitle = title ?? fallback.title;
  const resolvedDescription = description ?? fallback.description;

  return (
    <div
      aria-label={resolvedTitle}
      className="mt-6 rounded-xl border border-border bg-muted px-5 py-6 text-sm text-muted-foreground"
    >
      <p className="sr-only">{resolvedTitle}</p>
      <p>{resolvedDescription}</p>
      {actionLabel ? (
        disabled || !actionHref ? (
          <button
            type="button"
            disabled
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-border bg-muted px-4 text-sm font-semibold text-muted-foreground"
          >
            {actionLabel}
          </button>
        ) : (
          <Link
            href={actionHref}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            {actionLabel}
          </Link>
        )
      ) : null}
    </div>
  );
}

export function DashboardRecentJobs({
  jobs,
}: {
  jobs: DashboardJobSummary[];
}) {
  return (
    <div className="mt-6 grid gap-3">
      {jobs.map((job) => {
        const status = getJobStatusDisplay(job.status);

        return (
          <article
            key={job.id}
            className="rounded-xl border border-border bg-muted p-4 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/40"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${status.className}`}
                    title={status.description}
                  >
                    {status.label}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Posted {formatDashboardDate(job.createdAt)}
                  </span>
                </div>
                <h3 className="mt-3 break-words text-base font-bold tracking-tight text-card-foreground">
                  {job.title}
                </h3>
                <p className="mt-1 break-words text-sm font-semibold text-muted-foreground">
                  {job.companyName}
                </p>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
                  <span>{job.location}</span>
                  <span aria-hidden="true">/</span>
                  <span>{job.employmentType}</span>
                  <span aria-hidden="true">/</span>
                  <span>{job.applicationsCount} applications</span>
                </div>
              </div>

              {job.action.disabled || !job.action.href ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-muted-foreground"
                >
                  <span>{job.action.label}</span>
                  {job.action.badge ? (
                    <DashboardBadgePill badge={job.action.badge} />
                  ) : null}
                </button>
              ) : (
                <Link
                  href={job.action.href}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card px-4 text-xs font-semibold text-card-foreground transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                >
                  {job.action.label}
                </Link>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function DashboardRecentApplications({
  applications,
  error,
}: {
  applications: DashboardRecruiterApplication[];
  error: string | null;
}) {
  if (error) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-muted px-5 py-6 text-sm text-muted-foreground">
        <p className="font-semibold text-card-foreground">
          Applications are temporarily unavailable.
        </p>
        <p className="mt-2 leading-6">Please try again from the Applications page.</p>
        <Link
          href="/applications"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200"
        >
          View Applications
        </Link>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <DashboardEmptyState
        actionHref="/applications"
        actionLabel="View Applications"
        description="Applications received for your jobs will appear here."
        title="No applications yet"
        variant="applications"
      />
    );
  }

  return (
    <div className="mt-6 grid gap-3">
      {applications.map((application) => (
        <article
          key={application.id}
          className="rounded-xl border border-border bg-muted p-4 transition-colors duration-200 hover:border-yellow-300"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <CandidateAvatar
                ariaLabel="candidate avatar"
                imageUrl={application.candidateAvatarUrl}
                name={application.candidateName}
              />
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-bold text-card-foreground"
                  title={application.candidateName}
                >
                  {application.candidateName}
                </p>
                <p
                  className="truncate text-sm text-muted-foreground"
                  title={application.jobTitle}
                >
                  {application.jobTitle}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Applied {formatDashboardDate(application.appliedAt)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <ApplicationStatusBadge compact status={application.status} />
              <Link
                href="/applications"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground transition-colors hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
              >
                Open Applications
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function DashboardUpcomingInterviews({
  error,
  interviews,
}: {
  error: string | null;
  interviews: DashboardRecruiterInterview[];
}) {
  if (error) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-muted px-5 py-6 text-sm text-muted-foreground">
        <p className="font-semibold text-card-foreground">
          Upcoming interviews are temporarily unavailable.
        </p>
        <p className="mt-2 leading-6">Please try again from the Interviews page.</p>
        <Link
          href="/interviews"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200"
        >
          View Interviews
        </Link>
      </div>
    );
  }

  if (interviews.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-muted px-5 py-6 text-sm text-muted-foreground">
        <p className="font-semibold text-card-foreground">No upcoming interviews.</p>
        <p className="mt-2 leading-6">
          Schedule an interview from an applicant&apos;s details when you are ready.
        </p>
        <Link
          href="/applications"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground transition-colors hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
        >
          View Applicants
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-3">
      {interviews.map((interview) => (
        <article
          key={interview.id}
          className="rounded-xl border border-border bg-muted p-4 transition-colors duration-200 hover:border-yellow-300"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-card-foreground" title={interview.candidateName}>
                {interview.candidateName}
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground" title={interview.jobTitle}>
                {interview.jobTitle}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
                <span>{formatInterviewDateTime(interview.scheduledStart, interview.timezone)}</span>
                <span aria-hidden="true">/</span>
                <span>{getInterviewTypeLabel(interview.interviewType)}</span>
              </div>
            </div>
            <Link
              href={`/applications?applicationId=${encodeURIComponent(interview.applicationId)}`}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card px-4 text-xs font-semibold text-card-foreground transition-colors hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
            >
              Open Applicant
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

export function DashboardQuickAction({
  badge,
  description,
  disabled,
  href,
  icon,
  iconLabel,
  title,
  variant = "secondary",
}: DashboardQuickActionProps) {
  const label = `${title}. ${description}`;
  const content = (
    <>
      {icon ? (
        <span aria-label={iconLabel} aria-hidden={iconLabel ? undefined : true}>
          {icon}
        </span>
      ) : null}
      <span>{title}</span>
      <DashboardBadgePill badge={badge} />
    </>
  );

  if (disabled || !href) {
    return (
      <button
        type="button"
        disabled
        aria-label={label}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-muted px-5 text-sm font-semibold text-muted-foreground"
      >
        {content}
      </button>
    );
  }

  const isPricingAction = title.toLowerCase().includes("pricing");
  const isPrimaryAction =
    variant === "primary" ||
    title === "View Jobs" ||
    title === "View Pricing";
  const className =
    isPrimaryAction
      ? "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
      : isPricingAction
        ? "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-yellow-300 bg-yellow-50 px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:bg-yellow-100 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-yellow-500/10"
        : "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-muted px-5 text-sm font-semibold text-card-foreground transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5";

  return (
    <Link href={href} aria-label={label} className={className}>
      {content}
    </Link>
  );
}

export function DashboardQuickActionWidget({
  action,
}: {
  action: DashboardQuickActionItem;
}) {
  return (
    <DashboardQuickAction
      badge={action.badge}
      description={action.description}
      disabled={action.disabled}
      href={action.href}
      title={action.title}
      variant={action.variant}
    />
  );
}

export function DashboardSkeleton() {
  const statSkeletons = ["stat-1", "stat-2", "stat-3", "stat-4"];
  const actionSkeletons = ["action-1", "action-2", "action-3"];

  return (
    <main
      aria-busy="true"
      aria-label="Loading dashboard"
      className="min-h-screen bg-white px-6 py-10 text-gray-900 sm:px-8 sm:py-14 lg:px-12"
      role="status"
    >
      <section className="mx-auto flex w-full max-w-6xl flex-col">
        <div className="animate-pulse">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="w-full max-w-2xl">
              <div className="h-4 w-28 rounded-full bg-gray-100" />
              <div className="mt-5 h-12 w-3/4 rounded-2xl bg-gray-100" />
              <div className="mt-5 h-5 w-full rounded-full bg-gray-100" />
              <div className="mt-3 h-5 w-2/3 rounded-full bg-gray-100" />
              <div className="mt-5 h-8 w-48 rounded-full bg-yellow-50" />
            </div>
            <div className="flex gap-3">
              <div className="h-11 w-24 rounded-xl bg-gray-100" />
              <div className="h-11 w-24 rounded-xl bg-gray-100" />
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {statSkeletons.map((key) => (
              <div
                key={key}
                className="h-36 rounded-xl border border-gray-200 bg-white p-6 shadow-[0_18px_45px_rgba(17,24,39,0.08)]"
              >
                <div className="h-4 w-24 rounded-full bg-gray-100" />
                <div className="mt-7 h-10 w-20 rounded-xl bg-gray-100" />
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {actionSkeletons.map((key) => (
              <div key={key} className="h-12 rounded-xl bg-gray-100" />
            ))}
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="h-64 rounded-xl border border-gray-200 bg-white shadow-[0_18px_45px_rgba(17,24,39,0.08)]" />
            <div className="h-64 rounded-xl border border-gray-200 bg-white shadow-[0_18px_45px_rgba(17,24,39,0.08)]" />
          </div>
        </div>
      </section>
    </main>
  );
}
