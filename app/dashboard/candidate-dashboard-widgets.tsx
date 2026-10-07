import Link from "next/link";
import type { CandidateProfile } from "@/lib/candidate-profile";
import type { CandidateDashboardApplication } from "@/lib/candidate-dashboard";
import { getApplicationStatusDisplay } from "@/lib/applications";
import type { PublicJobListItem } from "@/lib/public-jobs";
import ApplicationStatusBadge from "@/app/applications/application-status-badge";
import { JobCard } from "@/app/jobs/jobs-list";
import {
  ApplicationDocumentsIllustration,
  RecommendationIllustration,
} from "./dashboard-illustrations";

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
    <section className="candidate-dashboard-panel candidate-applications-panel">
      <header className="candidate-dashboard-panel-header">
        <div>
          <h2>Recent Applications</h2>
          <p>Keep up with the roles you have already applied to.</p>
        </div>
        <Link className="candidate-dashboard-panel-action" href="/applications">
          View All
        </Link>
      </header>
      {error ? (
        <div className="candidate-dashboard-panel-error">
          {error}
        </div>
      ) : applications.length === 0 ? (
        <div className="candidate-applications-empty">
          <ApplicationDocumentsIllustration />
          <div>
            <h3>No applications yet.</h3>
            <p>Start applying to jobs and track your progress here.</p>
            <Link className="candidate-dashboard-dark-button" href="/jobs">
              Browse Jobs
            </Link>
          </div>
        </div>
      ) : (
        <div className="candidate-applications-list">
          {applications.map((application) => {
            const status = getApplicationStatusDisplay(application.status);
            const companyInitial = application.companyName.charAt(0).toUpperCase() || "C";

            return (
              <article
                className="candidate-application-row"
                key={application.id}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      aria-label={`${application.companyName} logo`}
                      className="candidate-application-avatar"
                      title={`${application.companyName} logo`}
                    >
                      {companyInitial}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#10162F]" title={application.jobTitle}>
                        {application.jobTitle}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-[#69728E]" title={application.companyName}>
                        {application.companyName}
                      </p>
                      <p className="mt-2 text-xs text-[#7E87A3]">
                        Applied {formatDate(application.appliedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <ApplicationStatusBadge compact status={application.status} />
                    <Link
                      className="candidate-application-view"
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
    </section>
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
    <section className="candidate-dashboard-panel candidate-completion-panel">
      <header className="candidate-dashboard-panel-header">
        <div>
          <h2>Profile Completion</h2>
          <p>A complete profile gives recruiters a clearer picture of your fit.</p>
        </div>
        <Link className="candidate-dashboard-panel-action" href="/settings/profile">
          Edit Profile
        </Link>
      </header>
      {profileError ? (
        <div className="candidate-dashboard-panel-error">
          {profileError}
        </div>
      ) : (
        <div className="candidate-completion-content">
          <div className="candidate-completion-progress-copy">
            <span>{completion}% complete</span>
            {completion < 100 ? <span>Keep going</span> : <span className="is-complete">Complete</span>}
          </div>
          <div
            aria-label={`Profile ${completion}% complete`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={completion}
            className="candidate-completion-progress"
            role="progressbar"
          >
            <div className="candidate-completion-progress-fill" style={{ width: `${completion}%` }} />
          </div>
          {completion < 100 && missing.length > 0 ? (
            <div className="candidate-completion-missing">
              <p>Missing</p>
              <div>
                {missing.map((section) => (
                  <Link
                    className="candidate-completion-pill"
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
            <p className="candidate-completion-helper">
              Complete your profile to improve recruiter visibility.
            </p>
          ) : null}
        </div>
      )}
    </section>
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
    <section className="candidate-dashboard-panel candidate-recommendations-panel">
      <header className="candidate-dashboard-panel-header">
        <div>
          <h2>Recommended Jobs</h2>
          <p>Published jobs matched from your current profile preferences, with latest jobs as a safe fallback.</p>
        </div>
      </header>
      {error ? (
        <div className="candidate-dashboard-panel-error">
          Recommendations are temporarily unavailable. Browse all published jobs instead.
          <Link className="candidate-dashboard-error-link" href="/jobs">
            Browse Jobs
          </Link>
        </div>
      ) : jobs.length === 0 ? (
        <div className="candidate-recommendations-empty">
          <RecommendationIllustration />
          <div>
            <h3>No matching jobs yet.</h3>
            <p>Browse all published jobs to keep exploring.</p>
            <Link className="candidate-dashboard-dark-button" href="/jobs">
              Browse Jobs
            </Link>
          </div>
        </div>
      ) : (
        <div className="candidate-recommendations-grid">
          {jobs.map((job) => (
            <JobCard job={job} key={job.slug} showApply />
          ))}
        </div>
      )}
    </section>
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
    <div className="candidate-dashboard-lower">
      <div className="candidate-dashboard-lower-grid">
        <RecentApplications applications={applications} error={applicationsError} />
        <ProfileCompletion
          candidateProfile={candidateProfile}
          fullName={fullName}
          profileError={profileError}
        />
      </div>
      <div className="candidate-dashboard-recommendations">
        <RecommendedJobs error={recommendationsError} jobs={recommendations} />
      </div>
    </div>
  );
}
