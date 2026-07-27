import Link from "next/link";
import type { CandidateProfile } from "@/lib/candidate-profile";
import type { CandidateDashboardApplication } from "@/lib/candidate-dashboard";
import { getApplicationStatusDisplay } from "@/lib/applications";
import type { PublicJobListItem } from "@/lib/public-jobs";
import ApplicationStatusBadge from "@/app/applications/application-status-badge";
import { DashboardSection } from "./dashboard-widgets";
import { JobCard } from "@/app/jobs/jobs-list";

function formatDate(value: string | null) {
  if (!value) {
    return "Date not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function missingProfileSections(
  profile: CandidateProfile | null,
  fullName: string | null,
) {
  const missing: string[] = [];

  if (!fullName?.trim()) missing.push("Full name");
  if (!profile?.professional_headline?.trim()) missing.push("Headline");
  if (!profile?.skills.length) missing.push("Skills");
  if (!profile?.experience?.trim()) missing.push("Experience");
  if (!profile?.education?.trim()) missing.push("Education");
  if (!profile?.location?.trim()) missing.push("Location");
  if (
    !profile?.portfolio_url?.trim() &&
    !profile?.linkedin_url?.trim() &&
    !profile?.github_url?.trim()
  ) {
    missing.push("Portfolio or social link");
  }
  if (!profile?.profile_photo_path) missing.push("Profile photo");
  if (!profile?.resume_path) missing.push("Resume");
  if (!profile?.preferred_job_title?.trim()) missing.push("Preferred job title");
  if (!profile?.preferred_location?.trim()) missing.push("Preferred location");
  if (!profile?.work_preference) missing.push("Work preference");
  if (profile?.years_of_experience === null || profile?.years_of_experience === undefined) {
    missing.push("Years of experience");
  }

  return missing;
}

function RecentApplications({
  applications,
  error,
}: {
  applications: CandidateDashboardApplication[];
  error: string | null;
}) {
  return (
    <DashboardSection
      actionHref="/applications"
      actionLabel="View All"
      description="Keep up with the roles you have already applied to."
      title="Recent Applications"
    >
      {error ? (
        <div className="mt-6 rounded-xl border border-border bg-muted p-5 text-sm text-muted-foreground">
          {error}
        </div>
      ) : applications.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted p-6">
          <h3 className="text-sm font-bold text-card-foreground">No applications yet.</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Start applying to jobs and track your progress here.
          </p>
          <Link
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200"
            href="/jobs"
          >
            Browse Jobs
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {applications.map((application) => {
            const status = getApplicationStatusDisplay(application.status);
            const companyInitial = application.companyName.charAt(0).toUpperCase() || "C";

            return (
              <article
                className="rounded-xl border border-border bg-muted p-4"
                key={application.id}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      aria-label={`${application.companyName} logo`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground"
                      title={`${application.companyName} logo`}
                    >
                      {companyInitial}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-card-foreground" title={application.jobTitle}>
                        {application.jobTitle}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-muted-foreground" title={application.companyName}>
                        {application.companyName}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Applied {formatDate(application.appliedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <ApplicationStatusBadge compact status={application.status} />
                    <Link
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-card px-3 text-xs font-semibold text-card-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200"
                      href="/applications"
                      title={status.description}
                    >
                      View Application
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </DashboardSection>
  );
}

function ProfileCompletion({
  candidateProfile,
  fullName,
  profileError,
}: {
  candidateProfile: CandidateProfile | null;
  fullName: string | null;
  profileError: string | null;
}) {
  const completion = candidateProfile?.profile_completion ?? 0;
  const missing = missingProfileSections(candidateProfile, fullName).slice(0, 5);

  return (
    <DashboardSection
      actionHref="/settings/profile"
      actionLabel="Edit Profile"
      description="A complete profile gives recruiters a clearer picture of your fit."
      title="Profile Completion"
    >
      {profileError ? (
        <div className="mt-6 rounded-xl border border-border bg-muted p-5 text-sm text-muted-foreground">
          {profileError}
        </div>
      ) : (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-card-foreground">
            <span>{completion}% complete</span>
            {completion < 100 ? <span className="text-muted-foreground">Keep going</span> : <span className="text-emerald-600 dark:text-emerald-300">Complete</span>}
          </div>
          <div
            aria-label={`Profile ${completion}% complete`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={completion}
            className="mt-3 h-2 overflow-hidden rounded-full bg-muted-foreground/20"
            role="progressbar"
          >
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${completion}%` }} />
          </div>
          {completion < 100 && missing.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Missing</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {missing.map((section) => (
                  <Link
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-card-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200"
                    href="/settings/profile"
                    key={section}
                  >
                    {section}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          {completion < 100 ? (
            <p className="mt-5 text-sm leading-6 text-muted-foreground">
              Complete your profile to improve recruiter visibility.
            </p>
          ) : null}
        </div>
      )}
    </DashboardSection>
  );
}

function RecommendedJobs({
  error,
  jobs,
}: {
  error: string | null;
  jobs: PublicJobListItem[];
}) {
  return (
    <DashboardSection
      actionHref="/jobs"
      actionLabel="Browse All Jobs"
      description="Published jobs matched from your current profile preferences, with latest jobs as a safe fallback."
      title="Recommended Jobs"
    >
      {error ? (
        <div className="mt-6 rounded-xl border border-border bg-muted p-5 text-sm text-muted-foreground">
          Recommendations are temporarily unavailable. Browse all published jobs instead.
          <Link className="mt-3 inline-flex font-semibold text-accent-foreground underline" href="/jobs">
            Browse Jobs
          </Link>
        </div>
      ) : jobs.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
          No matching jobs yet. Browse all published jobs to keep exploring.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {jobs.map((job) => (
            <JobCard job={job} key={job.slug} showApply />
          ))}
        </div>
      )}
    </DashboardSection>
  );
}

export default function CandidateDashboardWidgets({
  applications,
  applicationsError,
  candidateProfile,
  fullName,
  profileError,
  recommendations,
  recommendationsError,
}: {
  applications: CandidateDashboardApplication[];
  applicationsError: string | null;
  candidateProfile: CandidateProfile | null;
  fullName: string | null;
  profileError: string | null;
  recommendations: PublicJobListItem[];
  recommendationsError: string | null;
}) {
  return (
    <div className="mt-12 grid gap-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <RecentApplications applications={applications} error={applicationsError} />
        <ProfileCompletion
          candidateProfile={candidateProfile}
          fullName={fullName}
          profileError={profileError}
        />
      </div>
      <RecommendedJobs error={recommendationsError} jobs={recommendations} />
    </div>
  );
}
