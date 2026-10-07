import Link from "next/link";
import type {
  DashboardQuickActionItem,
  DashboardStat,
} from "@/lib/dashboard-data";
import {
  DashboardBellIcon,
  DashboardBookmarkIcon,
  DashboardPersonIcon,
  DashboardSearchIcon,
  DashboardSparkle,
} from "./dashboard-illustrations";

type CandidateStatKind = "alerts" | "completion" | "saved";

function getStatKind(stat: DashboardStat): CandidateStatKind {
  if (stat.id === "saved-jobs") return "saved";
  if (stat.id === "active-job-alerts") return "alerts";
  return "completion";
}

function CandidateStatIcon({ kind }: { kind: CandidateStatKind }) {
  if (kind === "saved") {
    return <DashboardBookmarkIcon />;
  }

  if (kind === "alerts") {
    return <DashboardBellIcon />;
  }

  return <DashboardPersonIcon />;
}

function CandidateStatCard({ stat }: { stat: DashboardStat }) {
  const kind = getStatKind(stat);
  const card = (
    <article className={`candidate-dashboard-stat-card candidate-dashboard-stat-${kind}`}>
      <span className="candidate-dashboard-stat-icon">
        <CandidateStatIcon kind={kind} />
      </span>
      <div className="candidate-dashboard-stat-copy">
        <h2>{stat.title}</h2>
        {stat.supportingText ? <p>{stat.supportingText}</p> : null}
        <strong>{stat.value}</strong>
      </div>
      {kind === "saved" ? (
        <DashboardSparkle className="candidate-dashboard-stat-spark" />
      ) : null}
      {kind === "alerts" ? <span className="candidate-dashboard-stat-dots" /> : null}
      {kind === "completion" ? <span className="candidate-dashboard-stat-ring" /> : null}
    </article>
  );

  if (stat.href && !stat.disabled) {
    return (
      <Link
        aria-label={`${stat.title}. ${stat.supportingText ?? "View details"}`}
        className="candidate-dashboard-stat-link"
        href={stat.href}
      >
        {card}
      </Link>
    );
  }

  return card;
}

export function CandidateDashboardStats({ stats }: { stats: DashboardStat[] }) {
  return (
    <section aria-label="Job seeker dashboard summary" className="candidate-dashboard-stats">
      {stats
        .filter((stat) => stat.id !== "active-job-alerts")
        .map((stat) => <CandidateStatCard key={stat.id} stat={stat} />)}
    </section>
  );
}

function CandidateActionIcon({ id }: { id: string }) {
  if (id === "saved-jobs") return <DashboardBookmarkIcon />;
  if (id === "job-alerts") return <DashboardBellIcon />;
  return <DashboardSearchIcon />;
}

function CandidateAction({ action }: { action: DashboardQuickActionItem }) {
  const selected = action.id === "browse-jobs";
  const className = `candidate-dashboard-action ${selected ? "is-selected" : ""}`;
  const content = (
    <>
      <CandidateActionIcon id={action.id} />
      <span>{action.title}</span>
    </>
  );

  if (action.disabled || !action.href) {
    return (
      <button className={className} disabled type="button">
        {content}
      </button>
    );
  }

  return (
    <Link className={className} href={action.href}>
      {content}
    </Link>
  );
}

export function CandidateDashboardActions({
  actions,
}: {
  actions: DashboardQuickActionItem[];
}) {
  return (
    <nav aria-label="Job seeker actions" className="candidate-dashboard-actions">
      {actions
        .filter((action) => action.id !== "job-alerts")
        .map((action) => <CandidateAction action={action} key={action.id} />)}
    </nav>
  );
}
