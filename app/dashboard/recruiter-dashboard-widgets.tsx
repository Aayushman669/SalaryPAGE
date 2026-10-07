import Link from "next/link";
import type { ReactNode } from "react";
import type {
  RecruiterApplicationDashboardData,
} from "@/lib/dashboard-data";
import { DashboardUpcomingInterviews } from "./dashboard-widgets";
import {
  InterviewRoomIllustration,
} from "./recruiter-illustrations";

function HeaderIcon({ type }: { type: "briefcase" | "calendar" }) {
  return (
    <span className="recruiter-panel-icon" aria-hidden="true">
      <svg fill="none" viewBox="0 0 24 24">
        {type === "briefcase" ? (
          <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6"><path d="M4 8h16v12H4zM8 8V5h8v3M4 12h16" /></g>
        ) : (
          <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6"><rect height="16" rx="2" width="16" x="4" y="5" /><path d="M8 3v4m8-4v4M4 10h16m-11 4h.1m3 0h.1m3 0h.1m-6 3h.1m3 0h.1" /></g>
        )}
      </svg>
    </span>
  );
}

function RecruiterPanel({ actionHref, actionLabel, children, description, icon, title }: {
  actionHref: string;
  actionLabel: string;
  children: ReactNode;
  description: string;
  icon: "briefcase" | "calendar";
  title: string;
}) {
  return (
    <section className="recruiter-dashboard-panel">
      <header className="recruiter-dashboard-panel-header">
        <div className="recruiter-dashboard-panel-title"><HeaderIcon type={icon} /><div><h2>{title}</h2><p>{description}</p></div></div>
        <Link className="recruiter-panel-action" href={actionHref}>{actionLabel}</Link>
      </header>
      {children}
    </section>
  );
}

function UpcomingInterviews({ applicationDashboard }: { applicationDashboard: RecruiterApplicationDashboardData }) {
  const { upcomingInterviews: interviews, upcomingInterviewsError: error } = applicationDashboard;
  return (
    <RecruiterPanel actionHref="/interviews" actionLabel="View All Interviews" description="Your next scheduled conversations with candidates." icon="calendar" title="Upcoming Interviews">
      {error || interviews.length > 0 ? <DashboardUpcomingInterviews error={error} interviews={interviews} /> : (
        <div className="recruiter-feature-empty recruiter-interviews-empty">
          <div><p className="recruiter-feature-empty-title">No upcoming interviews.</p><p>Schedule an interview from an applicant&apos;s details when you are ready.</p><Link className="recruiter-light-button" href="/applications">View Applicants</Link></div>
          <InterviewRoomIllustration />
        </div>
      )}
    </RecruiterPanel>
  );
}

export default function RecruiterDashboardWidgets({ applicationDashboard }: {
  applicationDashboard: RecruiterApplicationDashboardData;
}) {
  return <div className="recruiter-dashboard-lower"><UpcomingInterviews applicationDashboard={applicationDashboard} /></div>;
}
