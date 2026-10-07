"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useAuth } from "../auth-context";
import {
  getDisplayName,
  getRoleLabel,
  isValidRole,
  type DashboardProfile,
  type DashboardRole,
  type JobSeekerDashboardData,
  type RecruiterDashboardData,
  type RoleBasedDashboardData,
} from "@/lib/dashboard-data";
import {
  DashboardSkeleton,
} from "./dashboard-widgets";
import { useDashboardData } from "./use-dashboard-data";
import type { CompanyProfile } from "@/lib/company-profile";
import type { CandidateProfile } from "@/lib/candidate-profile";
import { createFreeSubscriptionSnapshot } from "@/lib/subscriptions";
import { SavedJobsProvider } from "@/app/jobs/saved-jobs-state";
import {
  CandidateDashboardActions,
  CandidateDashboardStats,
} from "./candidate-dashboard-summary";
import {
  CandidateDashboardDecorations,
  DashboardDiamondIcon,
} from "./dashboard-illustrations";
import {
  RecruiterDashboardDecorations,
} from "./recruiter-illustrations";
import {
  RecruiterDashboardActions,
  RecruiterDashboardStats,
} from "./recruiter-dashboard-summary";
import RecruiterDashboardWidgets from "./recruiter-dashboard-widgets";

function DashboardDeferredLoading({ className }: { className: string }) {
  return (
    <div
      aria-busy="true"
      className={`animate-pulse rounded-2xl border border-border bg-card ${className}`}
      role="status"
    />
  );
}

const RecruiterAnalytics = dynamic(() => import("./recruiter-analytics"), {
  loading: () => <DashboardDeferredLoading className="h-[34rem]" />,
});
const PremiumAnalyticsLocked = dynamic(
  () => import("./premium-analytics-locked"),
  { loading: () => <DashboardDeferredLoading className="h-56" /> },
);
const RecruiterSubscriptionSummary = dynamic(
  () => import("./subscription-summary"),
  { loading: () => <DashboardDeferredLoading className="h-52" /> },
);
const CandidateProfileSummary = dynamic(
  () => import("./candidate-profile-summary"),
  { loading: () => <DashboardDeferredLoading className="mt-8 h-48" /> },
);
const CandidateDashboardWidgets = dynamic(
  () => import("./candidate-dashboard-widgets"),
  { loading: () => <DashboardDeferredLoading className="mt-12 h-[38rem]" /> },
);

function DashboardShell({
  action,
  children,
  email,
  heading,
  role,
  subtitle,
}: {
  action?: ReactNode;
  children: ReactNode;
  email?: string | null;
  heading: string;
  role: DashboardRole;
  subtitle: string;
}) {
  const isCandidateDashboard = role === "job_seeker";
  const isRecruiterDashboard = role === "recruiter";
  const displayName = heading.replace(/^Welcome back,\s*/, "");

  return (
    <main className={isCandidateDashboard ? "candidate-dashboard-page" : isRecruiterDashboard ? "recruiter-dashboard-page" : "min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12"}>
      {isCandidateDashboard ? <CandidateDashboardDecorations /> : null}
      {isRecruiterDashboard ? <RecruiterDashboardDecorations /> : null}
      <section className={isCandidateDashboard ? "candidate-dashboard-content" : isRecruiterDashboard ? "recruiter-dashboard-content" : "mx-auto flex w-full max-w-6xl flex-col"}>
        <header className={isCandidateDashboard ? "candidate-dashboard-hero" : isRecruiterDashboard ? "recruiter-dashboard-hero" : "flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between"}>
          <div className={isCandidateDashboard ? "candidate-dashboard-hero-copy" : isRecruiterDashboard ? "recruiter-dashboard-hero-copy" : ""}>
            <p className={isCandidateDashboard ? "candidate-dashboard-eyebrow" : isRecruiterDashboard ? "recruiter-dashboard-eyebrow" : "text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground"}>
              Dashboard
            </p>
            <h1 className={isCandidateDashboard ? "candidate-dashboard-heading" : isRecruiterDashboard ? "recruiter-dashboard-heading" : "mt-4 break-words text-4xl font-bold tracking-tight text-foreground sm:text-5xl"}>
              {isCandidateDashboard || isRecruiterDashboard ? (
                <>
                  <span>Welcome back,</span>
                  <span>{displayName}</span>
                </>
              ) : heading}
            </h1>
            <p className={isCandidateDashboard ? "candidate-dashboard-subtitle" : isRecruiterDashboard ? "recruiter-dashboard-subtitle" : "mt-5 max-w-2xl text-lg leading-8 text-muted-foreground"}>
              {subtitle}
            </p>
            <div className={isCandidateDashboard ? "candidate-dashboard-role-row" : isRecruiterDashboard ? "recruiter-dashboard-role-row" : "mt-5 flex flex-wrap items-center gap-3"}>
              <span className={isCandidateDashboard ? "candidate-dashboard-role-pill" : isRecruiterDashboard ? "recruiter-dashboard-role-pill" : "inline-flex rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-900"}>
                {getRoleLabel(role)}
              </span>
              {email ? (
                <>
                  <span className={isCandidateDashboard ? "candidate-dashboard-email" : isRecruiterDashboard ? "recruiter-dashboard-email" : "max-w-full break-all text-sm font-medium text-muted-foreground"}>
                    {email}
                  </span>
                  {isRecruiterDashboard ? (
                    <span aria-label="Verified recruiter email" className="recruiter-dashboard-verified" title="Verified recruiter email">
                      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                        <path d="m7 12.5 3.2 3.2L17.5 8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
                      </svg>
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          {action ? (
            <div className={isCandidateDashboard ? "candidate-dashboard-top-actions" : isRecruiterDashboard ? "recruiter-dashboard-top-actions" : "flex flex-wrap items-center gap-3"}>
              {action}
            </div>
          ) : null}
        </header>

        {children}
      </section>
    </main>
  );
}

function PricingAction() {
  return (
    <Link
      href="/pricing"
      className="candidate-dashboard-pricing-action"
    >
      <DashboardDiamondIcon />
      Pricing
    </Link>
  );
}

function DashboardContent({
  candidateProfile,
  candidateProfileError,
  dashboardData,
  profile,
}: {
  candidateProfile: CandidateProfile | null;
  candidateProfileError: string | null;
  dashboardData: RoleBasedDashboardData;
  profile: DashboardProfile;
}) {
  if (dashboardData.role === "job_seeker") {
    return (
      <>
        <CandidateDashboardStats stats={dashboardData.statCards} />
        <CandidateDashboardActions actions={dashboardData.quickActions} />
        <CandidateDashboardWidgets
          applications={dashboardData.candidateApplications}
          applicationsError={dashboardData.candidateApplicationsError}
          candidateProfile={candidateProfile}
          fullName={profile.full_name}
          profileError={candidateProfileError}
          recommendations={dashboardData.candidateRecommendations}
          recommendationsError={dashboardData.candidateRecommendationsError}
        />
      </>
    );
  }

  if (dashboardData.role === "recruiter") {
    const subscription =
      dashboardData.subscription ?? createFreeSubscriptionSnapshot();

    return (
      <>
        <RecruiterDashboardStats stats={dashboardData.statCards} />
        <RecruiterDashboardActions actions={dashboardData.quickActions} />
        <div className="recruiter-dashboard-subscription">
          <RecruiterSubscriptionSummary subscription={subscription} />
        </div>
        <div className="recruiter-dashboard-analytics">
          {dashboardData.analyticsAccess.allowed ? (
            <RecruiterAnalytics analytics={dashboardData.analytics} />
          ) : (
            <PremiumAnalyticsLocked access={dashboardData.analyticsAccess} subscription={dashboardData.subscription} />
          )}
        </div>
        <RecruiterDashboardWidgets applicationDashboard={dashboardData.applicationDashboard} />
      </>
    );
  }

  return null;
}

function RecruiterDashboard({
  dashboardData,
  company,
  profile,
}: {
  company: CompanyProfile | null;
  dashboardData: RecruiterDashboardData;
  profile: DashboardProfile;
}) {
  return (
    <DashboardShell
      email={profile.email}
      heading={`Welcome back, ${getDisplayName(profile)}`}
      role="recruiter"
      subtitle={
        company
          ? `${company.name} hiring workspace. Review candidates, jobs, and hiring progress in one place.`
          : "Set up your company profile, manage jobs, and review hiring activity in one place."
      }
    >
      <DashboardContent
        candidateProfile={null}
        candidateProfileError={null}
        dashboardData={dashboardData}
        profile={profile}
      />
    </DashboardShell>
  );
}

function JobSeekerDashboard({
  candidateProfile,
  candidateProfileError,
  dashboardData,
  profile,
}: {
  candidateProfile: ReturnType<typeof useDashboardData>["candidateProfile"];
  candidateProfileError: string | null;
  dashboardData: JobSeekerDashboardData;
  profile: DashboardProfile;
}) {
  return (
    <SavedJobsProvider
      jobSlugs={[
        ...dashboardData.savedJobsSummary.recentJobs
          .map((job) => job.jobSlug)
          .filter((slug): slug is string => Boolean(slug)),
        ...dashboardData.candidateRecommendations.map((job) => job.slug),
      ]}
    >
      <DashboardShell
        action={<PricingAction />}
        email={profile.email}
        heading={`Welcome back, ${getDisplayName(profile)}`}
        role="job_seeker"
        subtitle="Discover opportunities and keep track of your job search."
      >
        <CandidateProfileSummary
          candidateProfile={candidateProfile}
          profile={profile}
        />
        <DashboardContent
          candidateProfile={candidateProfile}
          candidateProfileError={candidateProfileError}
          dashboardData={dashboardData}
          profile={profile}
        />
      </DashboardShell>
    </SavedJobsProvider>
  );
}

function LockedDashboard() {
  return (
    <main className="ui-consistency-surface flex min-h-screen items-center justify-center bg-white px-6 py-10 text-gray-900 sm:px-8 sm:py-14 lg:px-12">
      <section className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
          Dashboard
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
          Login required
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          Login to access your dashboard.
        </p>
        <Link
          href="/login"
          className="mt-7 inline-flex h-12 items-center justify-center rounded-xl bg-black px-6 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_16px_34px_rgba(17,24,39,0.18)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
        >
          Login
        </Link>
      </section>
    </main>
  );
}

function DashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="ui-consistency-surface flex min-h-screen items-center justify-center bg-white px-6 py-10 text-gray-900 sm:px-8 sm:py-14 lg:px-12">
      <section className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">
          Dashboard unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
        >
          Retry
        </button>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthLoading, isLoggedIn } = useAuth();
  const {
    dashboardData,
    candidateProfile,
    candidateProfileError,
    company,
    error,
    loading,
    profile,
    retry,
  } = useDashboardData({ isAuthLoading, isLoggedIn });

  useEffect(() => {
    if (loading || !isLoggedIn || !profile) {
      return;
    }

    if (profile.profile_completed !== true || !isValidRole(profile.role_mode)) {
      router.replace("/onboarding");
    }
  }, [isLoggedIn, loading, profile, router]);

  if (isAuthLoading || loading) {
    return <DashboardSkeleton />;
  }

  if (!isLoggedIn) {
    return <LockedDashboard />;
  }

  if (error) {
    return <DashboardError message={error} onRetry={retry} />;
  }

  if (
    !profile ||
    profile.profile_completed !== true ||
    !isValidRole(profile.role_mode) ||
    !dashboardData
  ) {
    return (
      <DashboardError
        message="Your dashboard profile is not ready yet. Please retry or complete onboarding."
        onRetry={retry}
      />
    );
  }

  if (profile.role_mode === "recruiter" && dashboardData.role === "recruiter") {
    return (
      <RecruiterDashboard
        company={company}
        dashboardData={dashboardData}
        profile={profile}
      />
    );
  }

  if (dashboardData.role !== "job_seeker") {
    return <DashboardSkeleton />;
  }

  return (
    <JobSeekerDashboard
      candidateProfile={candidateProfile}
      candidateProfileError={candidateProfileError}
      dashboardData={dashboardData}
      profile={profile}
    />
  );
}
