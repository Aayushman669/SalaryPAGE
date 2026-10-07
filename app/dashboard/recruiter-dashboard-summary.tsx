import Link from "next/link";
import type { DashboardQuickActionItem, DashboardStat } from "@/lib/dashboard-data";

function Icon({ name }: { name: "briefcase" | "calendar" | "document" | "people" | "rocket" }) {
  const paths = {
    briefcase: <><path d="M4 8h16v12H4zM8 8V5h8v3M4 12h16" /></>,
    calendar: <><rect height="16" rx="2" width="16" x="4" y="5" /><path d="M8 3v4m8-4v4M4 10h16m-11 4h.1m3 0h.1m3 0h.1m-6 3h.1m3 0h.1" /></>,
    document: <><path d="M7 3h7l4 4v14H7zM14 3v5h5M10 12h5m-5 4h5" /></>,
    people: <><circle cx="9" cy="9" r="3" /><path d="M3.5 20c.7-4 2.5-6 5.5-6s4.8 2 5.5 6M16 7a3 3 0 0 1 0 5m1 2c2 1 3.2 3 3.5 6" /></>,
    rocket: <><path d="M14 4c3-1 5-1 6-1 0 1 0 3-1 6l-5 5-5-5 5-5Zm-6 7-4 2 3 2m3 2-2 4 4-3M12 7h.1" /></>,
  };
  return <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.65">{paths[name]}</g></svg>;
}

function statIcon(stat: DashboardStat) { if (stat.id === "active-jobs") return "briefcase"; if (stat.id === "total-applications") return "document"; if (stat.id === "interviews-scheduled") return "calendar"; return "people"; }

export function RecruiterDashboardStats({ stats }: { stats: DashboardStat[] }) {
  return <section aria-label="Recruiter dashboard statistics" className="recruiter-dashboard-stats">{stats.map((stat, index) => {
    const card = <article className={`recruiter-stat-card ${index === 0 || index === 3 ? "is-warm" : ""}`}><span className="recruiter-stat-icon"><Icon name={statIcon(stat)} /></span><div className="recruiter-stat-copy"><h2>{stat.title}</h2><p>{stat.supportingText}</p><strong>{stat.value}</strong></div>{index === 1 ? <i className="recruiter-stat-dots" /> : null}{index === 2 ? <i className="recruiter-stat-spark" /> : null}</article>;
    return stat.href && !stat.disabled ? <Link aria-label={`${stat.title}. ${stat.supportingText ?? "View details"}`} className="recruiter-stat-link" href={stat.href} key={stat.id}>{card}</Link> : <div key={stat.id}>{card}</div>;
  })}</section>;
}

export function RecruiterDashboardActions({ actions }: { actions: DashboardQuickActionItem[] }) {
  return <nav aria-label="Recruiter dashboard actions" className="recruiter-dashboard-actions">{actions.map((action) => {
    const primary = action.variant === "primary";
    const content = <>{primary ? <Icon name="rocket" /> : <Icon name="briefcase" />}<span>{action.title}</span></>;
    const className = `recruiter-dashboard-action ${primary ? "is-primary" : ""}`;
    return action.href && !action.disabled ? <Link aria-label={`${action.title}. ${action.description}`} className={className} href={action.href} key={action.id}>{content}</Link> : <button className={className} disabled key={action.id} type="button">{content}</button>;
  })}</nav>;
}
