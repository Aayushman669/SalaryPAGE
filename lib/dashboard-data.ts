import type { ProfileRow } from "@/lib/auth-profiles";
import {
  getApplicationStatusDisplay as getApplicationStatusDisplayBase,
  type ApplicationStatus,
} from "@/lib/applications";
import {
  formatEmploymentType,
  isEmploymentType,
  type EmploymentType,
} from "@/lib/jobs";
import {
  canViewPremiumAnalytics,
  canPostJob,
  getConfiguredJobPostLimit,
  getRemainingJobLimitForUsedJobs,
  getRemainingJobLimit as getSubscriptionRemainingJobLimit,
  type SubscriptionAccess,
  type SubscriptionSnapshot,
} from "@/lib/subscriptions";
import type { CandidateProfile } from "@/lib/candidate-profile";
import type { CandidateSavedJobsSummary } from "@/lib/saved-jobs";
import type {
  CandidateDashboardApplication,
  CandidateDashboardApplications,
} from "@/lib/candidate-dashboard";
import type { PublicJobListItem } from "@/lib/public-jobs";
import type { JobAlertsSummary } from "@/lib/job-alerts";

export type DashboardRole = "recruiter" | "job_seeker";
export type DashboardPlan =
  | "free"
  | "starter"
  | "growth"
  | "pro"
  | "enterprise";

export type DashboardStatValue = number | string;
export type DashboardIconName =
  | "activity"
  | "applications"
  | "briefcase"
  | "bookmark"
  | "calendar"
  | "clock"
  | "limit"
  | "plan"
  | "pricing"
  | "profile"
  | "search";

export type DashboardBadge = {
  className?: string;
  description?: string;
  label: string;
};

export type DashboardProfile = Omit<ProfileRow, "current_plan" | "role_mode"> & {
  current_plan: DashboardPlan;
  role_mode: DashboardRole | null;
};

export type DashboardUser = {
  avatarUrl: string | null;
  currentPlan: DashboardPlan;
  email: string | null;
  fullName: string;
  id: string;
  profileCompleted: boolean;
  role: DashboardRole | null;
};

export type DashboardStat = {
  badge?: DashboardBadge;
  disabled?: boolean;
  href?: string;
  icon?: DashboardIconName;
  id: string;
  loading?: boolean;
  supportingText?: string;
  title: string;
  value: DashboardStatValue;
  valueFormat?: "number" | "percent" | "plan" | "text";
};

export type DashboardChartPoint = {
  date?: string | null;
  id: string;
  label: string;
  status?: JobStatus;
  value: number;
};

export type RecruiterAnalyticsFunnelPoint = {
  id: string;
  label: string;
  status: ApplicationStatus;
  value: number;
};

export type RecruiterAnalyticsTrendPoint = {
  applications: number;
  date: string;
  hires: number;
  interviews: number;
  label: string;
  views: number;
};

export type RecruiterAnalyticsSource = {
  label: string;
  value: number;
};

export type DashboardQuickActionItem = {
  badge?: DashboardBadge;
  description: string;
  disabled?: boolean;
  href?: string;
  icon?: DashboardIconName;
  id: string;
  title: string;
  variant: "primary" | "secondary";
};

export type JobStatus =
  | "archived"
  | "closed"
  | "draft"
  | "pending"
  | "published"
  | "scheduled"
  | "unknown";
export type { ApplicationStatus } from "@/lib/applications";

export type DashboardStatusDisplay = {
  className: string;
  description?: string;
  label: string;
};

export type DashboardActivityItem = {
  createdAt: string | null;
  description: string;
  id: string;
  title: string;
  type: string;
};

export type DashboardJobSummary = {
  action: DashboardJobAction;
  applicationsCount: number;
  companyName: string;
  createdAt: string | null;
  employmentType: string;
  id: string;
  location: string;
  publishAt: string | null;
  slug: string;
  status: JobStatus;
  title: string;
  updatedAt: string | null;
};

export type DashboardRecruiterApplication = {
  appliedAt: string | null;
  candidateAvatarUrl: string | null;
  candidateId: string;
  candidateName: string;
  id: string;
  jobId: string;
  jobSlug: string;
  jobTitle: string;
  status: ApplicationStatus;
};

export type DashboardRecruiterInterview = {
  applicationId: string;
  candidateName: string;
  id: string;
  interviewType: string;
  jobSlug: string;
  jobTitle: string;
  scheduledEnd: string;
  scheduledStart: string;
  status: string;
  timezone: string;
};

export type RecruiterApplicationDashboardData = {
  error: string | null;
  hires: number;
  interviewsScheduled: number;
  upcomingInterviews: DashboardRecruiterInterview[];
  upcomingInterviewsError: string | null;
  recentApplications: DashboardRecruiterApplication[];
  recentApplicationsError: string | null;
  totalApplications: number;
};

export type DashboardJobPerformanceRow = {
  applicationsCount: number;
  conversionRate: number;
  createdAt: string | null;
  id: string;
  publishedAt: string | null;
  status: JobStatus;
  title: string;
  updatedAt: string | null;
  viewsCount: number;
};

export type DashboardJobAction = {
  badge?: DashboardBadge;
  disabled?: boolean;
  href?: string;
  label: string;
};

export type DashboardRecommendation = {
  companyName: string;
  createdAt: string | null;
  employmentType: string;
  id: string;
  location: string;
  title: string;
};

export type DashboardEmptyStateVariant =
  | "activity"
  | "applications"
  | "jobs"
  | "recommendations"
  | "saved-jobs";

export type DashboardEmptyStateData = {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  disabled?: boolean;
  title: string;
  variant: DashboardEmptyStateVariant;
};

export type DashboardPanel = {
  description: string;
  emptyState: DashboardEmptyStateData;
  id: string;
  title: string;
};

export type DashboardPanelGroup = {
  activity: DashboardPanel;
  primary: DashboardPanel;
};

export type RecruiterDashboardData = {
  analyticsAccess: SubscriptionAccess;
  analytics: RecruiterAnalyticsData;
  applicationDashboard: RecruiterApplicationDashboardData;
  quickActions: DashboardQuickActionItem[];
  recentActivity: DashboardActivityItem[];
  recentJobs: DashboardJobSummary[];
  role: "recruiter";
  sections: DashboardPanelGroup;
  statCards: DashboardStat[];
  stats: {
    activeJobs: DashboardStat;
    archivedJobs: DashboardStat;
    closedJobs: DashboardStat;
    draftJobs: DashboardStat;
    hires: DashboardStat;
    interviewsScheduled: DashboardStat;
    remainingJobLimit: DashboardStat;
    scheduledJobs: DashboardStat;
    totalApplications: DashboardStat;
  };
  subscription: SubscriptionSnapshot | null;
  user: DashboardUser;
};

export type RecruiterAnalyticsSummary = {
  activeJobs: number;
  averageApplicationsPerJob: number;
  closedJobs: number;
  conversionRate: number;
  draftJobs: number;
  hires: number;
  interviewsCompleted: number;
  interviewsScheduled: number;
  newApplicationsLast7Days: number;
  offersSent: number;
  rejections: number;
  totalApplications: number;
  totalJobViews: number;
};

export type RecruiterAnalyticsData = {
  charts: {
    applicationsLast30Days: DashboardChartPoint[];
    funnel: RecruiterAnalyticsFunnelPoint[];
    hiringTrend: RecruiterAnalyticsTrendPoint[];
    jobsByStatus: DashboardChartPoint[];
    viewsLast30Days: DashboardChartPoint[];
  };
  jobPerformance: DashboardJobPerformanceRow[];
  recentActivity: DashboardActivityItem[];
  sources: RecruiterAnalyticsSource[];
  summary: RecruiterAnalyticsSummary;
};

export type JobSeekerDashboardData = {
  candidateApplications: CandidateDashboardApplication[];
  candidateApplicationsError: string | null;
  candidateRecommendations: PublicJobListItem[];
  candidateRecommendationsError: string | null;
  quickActions: DashboardQuickActionItem[];
  recentActivity: DashboardActivityItem[];
  recommendedJobs: DashboardRecommendation[];
  role: "job_seeker";
  savedJobsSummary: CandidateSavedJobsSummary;
  sections: DashboardPanelGroup;
  statCards: DashboardStat[];
  stats: {
    activeJobAlerts: DashboardStat;
    profileStrength: DashboardStat;
    savedJobs: DashboardStat;
  };
  user: DashboardUser;
};

export type CandidateDashboardInput = {
  applications: CandidateDashboardApplications;
  jobAlerts: JobAlertsSummary;
  profile: CandidateProfile | null;
  recommendations: PublicJobListItem[];
  recommendationsError: string | null;
  savedJobs: CandidateSavedJobsSummary;
};

export type RoleBasedDashboardData =
  | RecruiterDashboardData
  | JobSeekerDashboardData;

export type DashboardJobRow = {
  applications_count?: number | null;
  applicationsCount?: number | null;
  company_name?: string | null;
  companyName?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  employment_type?: string | null;
  employmentType?: string | null;
  id?: string | null;
  location?: string | null;
  publish_at?: string | null;
  publishAt?: string | null;
  published_at?: string | null;
  publishedAt?: string | null;
  slug?: string | null;
  status?: string | null;
  title?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
  views_count?: number | null;
  viewsCount?: number | null;
};

export type RecruiterJobCounts = {
  archived: number;
  closed: number;
  draft: number;
  pending: number;
  published: number;
  scheduled: number;
};

export type RecruiterJobsDashboardInput = {
  applicationDashboard: RecruiterApplicationDashboardData;
  analytics: RecruiterAnalyticsData;
  counts: RecruiterJobCounts;
  recentJobs: DashboardJobSummary[];
  subscription: SubscriptionSnapshot | null;
};

export type DashboardActivityRow = {
  created_at?: string | null;
  createdAt?: string | null;
  description?: string | null;
  id?: string | null;
  title?: string | null;
  type?: string | null;
};

export type DashboardRecommendationRow = {
  company_name?: string | null;
  companyName?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  employment_type?: string | null;
  employmentType?: string | null;
  id?: string | null;
  location?: string | null;
  title?: string | null;
};

const planLabels: Record<DashboardPlan, string> = {
  enterprise: "Enterprise",
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
};

export const dashboardEmptyStates = {
  activity: {
    description: "No recent activity yet.",
    title: "No Activity",
    variant: "activity",
  },
  applications: {
    description: "No applications yet.",
    title: "No Applications",
    variant: "applications",
  },
  jobs: {
    actionHref: "/post-job",
    actionLabel: "Post your first job",
    description: "You haven't posted any jobs yet.",
    title: "You haven't posted any jobs yet.",
    variant: "jobs",
  },
  recommendations: {
    actionHref: "/jobs",
    actionLabel: "Browse Jobs",
    description:
      "Recommended jobs will appear here as the platform learns your preferences.",
    title: "No Recommendations",
    variant: "recommendations",
  },
  savedJobs: {
    description: "No saved jobs yet.",
    title: "No Saved Jobs",
    variant: "saved-jobs",
  },
} satisfies Record<string, DashboardEmptyStateData>;

const statusClassNames = {
  dark: "border-gray-900 bg-gray-900 text-white",
  neutral: "border-gray-200 bg-gray-50 text-gray-700",
  yellow: "border-yellow-300 bg-yellow-50 text-gray-900",
};

const jobStatusDisplays: Record<JobStatus, DashboardStatusDisplay> = {
  archived: {
    className: statusClassNames.neutral,
    description: "Hidden from normal recruiter workflows.",
    label: "Archived",
  },
  closed: {
    className: statusClassNames.neutral,
    description: "No longer accepting candidates.",
    label: "Closed",
  },
  draft: {
    className: statusClassNames.neutral,
    description: "Saved but not submitted for approval.",
    label: "Draft",
  },
  pending: {
    className: statusClassNames.yellow,
    description: "Waiting for review.",
    label: "Pending",
  },
  published: {
    className: statusClassNames.dark,
    description: "Visible to candidates.",
    label: "Published",
  },
  scheduled: {
    className: statusClassNames.yellow,
    description: "Published, but scheduled to become public later.",
    label: "Scheduled",
  },
  unknown: {
    className: statusClassNames.neutral,
    description: "This job has a status outside the supported production set.",
    label: "Unknown",
  },
};

function safeString(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function safeDate(value: string | null | undefined) {
  return value?.trim() || null;
}

function safeEmploymentType(value: string | null | undefined) {
  return isEmploymentType(value)
    ? formatEmploymentType(value as EmploymentType)
    : "Employment not specified";
}

function logUnknownJobStatus(status: string | null | undefined) {
  if (process.env.NODE_ENV !== "development" || !status) {
    return;
  }

  console.warn("[dashboard] unknown job status", { status });
}

export function isValidPlan(plan: string | null): plan is DashboardPlan {
  return (
    plan === "free" ||
    plan === "starter" ||
    plan === "growth" ||
    plan === "pro" ||
    plan === "enterprise"
  );
}

export function isValidRole(role: string | null): role is DashboardRole {
  return role === "recruiter" || role === "job_seeker";
}

function isJobStatus(status: string | null | undefined): status is JobStatus {
  return (
    status === "archived" ||
    status === "closed" ||
    status === "draft" ||
    status === "pending" ||
    status === "published" ||
    status === "scheduled" ||
    status === "unknown"
  );
}

export function normalizePlan(plan: string | null): DashboardPlan {
  return isValidPlan(plan) ? plan : "free";
}

export function normalizeRole(role: string | null): DashboardRole | null {
  return isValidRole(role) ? role : null;
}

export function normalizeDashboardProfile(
  profile: ProfileRow | null,
): DashboardProfile | null {
  if (!profile) {
    return null;
  }

  return {
    ...profile,
    current_plan: normalizePlan(profile.current_plan),
    role_mode: normalizeRole(profile.role_mode),
  };
}

export function formatPlan(plan: DashboardPlan | null) {
  return planLabels[plan ?? "free"];
}

export function getDisplayName(profile: Pick<DashboardProfile, "full_name">) {
  return profile.full_name?.trim() || "there";
}

export function getRoleLabel(role: DashboardRole) {
  return role === "recruiter" ? "Recruiter" : "Job Seeker";
}

export function getRemainingJobLimit(plan: DashboardPlan | null) {
  const limit = getConfiguredJobPostLimit(plan ?? "free");

  return limit === "unlimited" ? "Unlimited" : limit;
}

export const jobSlotConsumingStatuses = [
  "published",
  "scheduled",
  "pending",
] as const;

export function createEmptyRecruiterJobCounts(): RecruiterJobCounts {
  return {
    archived: 0,
    closed: 0,
    draft: 0,
    pending: 0,
    published: 0,
    scheduled: 0,
  };
}

function createEmptyAnalyticsTrend(prefix: string): DashboardChartPoint[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (29 - index));
    const dateId = date.toISOString().slice(0, 10);

    return {
      date: dateId,
      id: `${prefix}-${dateId}`,
      label: new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
      }).format(date),
      value: 0,
    };
  });
}

export function createEmptyRecruiterAnalyticsData(): RecruiterAnalyticsData {
  return {
    charts: {
      applicationsLast30Days: createEmptyAnalyticsTrend("applications"),
      funnel: [
        "applied",
        "reviewing",
        "shortlisted",
        "interview",
        "offered",
        "hired",
      ].map((status) => ({
        id: `funnel-${status}`,
        label: getApplicationStatusDisplayBase(status as ApplicationStatus).label,
        status: status as ApplicationStatus,
        value: 0,
      })),
      hiringTrend: createEmptyAnalyticsTrend("trend").map((point) => ({
        applications: 0,
        date: point.date ?? point.id,
        hires: 0,
        interviews: 0,
        label: point.label,
        views: 0,
      })),
      jobsByStatus: [
        "published",
        "scheduled",
        "pending",
        "draft",
        "closed",
        "archived",
      ].map((status) => ({
        id: `status-${status}`,
        label: getJobStatusDisplay(status).label,
        status: status as JobStatus,
        value: 0,
      })),
      viewsLast30Days: createEmptyAnalyticsTrend("views"),
    },
    jobPerformance: [],
    recentActivity: [],
    sources: [],
    summary: {
      activeJobs: 0,
      averageApplicationsPerJob: 0,
      closedJobs: 0,
      conversionRate: 0,
      draftJobs: 0,
      hires: 0,
      interviewsCompleted: 0,
      interviewsScheduled: 0,
      newApplicationsLast7Days: 0,
      offersSent: 0,
      rejections: 0,
      totalApplications: 0,
      totalJobViews: 0,
    },
  };
}

export function createEmptyRecruiterJobsDashboardInput(): RecruiterJobsDashboardInput {
  return {
    applicationDashboard: {
      error: null,
      hires: 0,
      interviewsScheduled: 0,
      upcomingInterviews: [],
      upcomingInterviewsError: null,
      recentApplications: [],
      recentApplicationsError: null,
      totalApplications: 0,
    },
    analytics: createEmptyRecruiterAnalyticsData(),
    counts: createEmptyRecruiterJobCounts(),
    recentJobs: [],
    subscription: null,
  };
}

export function getUsedJobSlots(counts: RecruiterJobCounts) {
  return jobSlotConsumingStatuses.reduce(
    (total, status) => total + counts[status],
    0,
  );
}

export function getRemainingJobLimitFromCounts(
  plan: DashboardPlan | null,
  counts: RecruiterJobCounts,
) {
  const limit = getRemainingJobLimit(plan);

  if (limit === "Unlimited") {
    return limit;
  }

  return Math.max(0, limit - getUsedJobSlots(counts));
}

export function getJobStatusDisplay(status: string | null | undefined) {
  return jobStatusDisplays[isJobStatus(status) ? status : "unknown"];
}

export function calculateDashboardConversionRate({
  applications,
  views,
}: {
  applications: number;
  views: number;
}) {
  if (views <= 0 || applications <= 0) {
    return 0;
  }

  return Math.round((applications / views) * 1000) / 10;
}

function isFutureDate(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const parsedDate = new Date(value);

  return (
    !Number.isNaN(parsedDate.getTime()) && parsedDate.getTime() > Date.now()
  );
}

export function normalizeDashboardJobStatus(
  status: string | null | undefined,
  publishAt?: string | null,
): JobStatus {
  if (status === "published" && isFutureDate(publishAt)) {
    return "scheduled";
  }

  if (isJobStatus(status) && status !== "unknown") {
    return status;
  }

  logUnknownJobStatus(status);
  return "unknown";
}

export function getDashboardJobAction(
  status: JobStatus,
  slug = "",
): DashboardJobAction {
  const actionLabels: Record<JobStatus, string> = {
    archived: "Manage Jobs",
    closed: "Manage Jobs",
    draft: "Manage Jobs",
    pending: "Manage Jobs",
    published: "View Job",
    scheduled: "Manage Jobs",
    unknown: "Manage Jobs",
  };

  const filter = status === "published" ? "active" : status;

  return {
    href:
      status === "published" && slug
        ? `/jobs/${encodeURIComponent(slug)}`
        : `/jobs?status=${filter}`,
    label: actionLabels[status],
  };
}

export function getApplicationStatusDisplay(
  status: string | null | undefined,
) {
  return getApplicationStatusDisplayBase(status);
}

export function calculateProfileCompletion(profile: DashboardProfile) {
  const checks = [
    Boolean(profile.full_name?.trim()),
    Boolean(profile.avatar_url?.trim()),
    isValidRole(profile.role_mode),
    Boolean(profile.email?.trim()),
    isValidPlan(profile.current_plan),
    profile.profile_completed === true,
  ];

  const completedFields = checks.filter(Boolean).length;

  return Math.round((completedFields / checks.length) * 100);
}

export function mapProfileToDashboardUser(
  profile: DashboardProfile,
): DashboardUser {
  return {
    avatarUrl: profile.avatar_url,
    currentPlan: profile.current_plan,
    email: profile.email,
    fullName: getDisplayName(profile),
    id: profile.id,
    profileCompleted: profile.profile_completed === true,
    role: profile.role_mode,
  };
}

export function mapJobRowToDashboardJob(
  row: DashboardJobRow,
): DashboardJobSummary {
  const publishAt = safeDate(row.publishAt ?? row.publish_at);
  const status = normalizeDashboardJobStatus(row.status, publishAt);
  const slug = safeString(row.slug, "");

  return {
    action: getDashboardJobAction(status, slug),
    applicationsCount: safeNumber(
      row.applicationsCount ?? row.applications_count,
    ),
    companyName: safeString(row.companyName ?? row.company_name, "Company"),
    createdAt: safeDate(row.createdAt ?? row.created_at),
    employmentType: safeEmploymentType(
      row.employmentType ?? row.employment_type,
    ),
    id: safeString(row.id, "job"),
    location: safeString(row.location, "Location not specified"),
    publishAt,
    slug,
    status,
    title: safeString(row.title, "Untitled job"),
    updatedAt: safeDate(row.updatedAt ?? row.updated_at),
  };
}

export function mapJobRowToDashboardPerformance(
  row: DashboardJobRow,
): DashboardJobPerformanceRow {
  const publishAt = safeDate(row.publishAt ?? row.publish_at);
  const viewsCount = safeNumber(row.viewsCount ?? row.views_count);
  const applicationsCount = safeNumber(
    row.applicationsCount ?? row.applications_count,
  );

  return {
    applicationsCount,
    conversionRate: calculateDashboardConversionRate({
      applications: applicationsCount,
      views: viewsCount,
    }),
    createdAt: safeDate(row.createdAt ?? row.created_at),
    id: safeString(row.id, "job"),
    publishedAt: safeDate(row.publishedAt ?? row.published_at),
    status: normalizeDashboardJobStatus(row.status, publishAt),
    title: safeString(row.title, "Untitled job"),
    updatedAt: safeDate(row.updatedAt ?? row.updated_at),
    viewsCount,
  };
}

export function mapActivityRowToDashboardActivity(
  row: DashboardActivityRow,
): DashboardActivityItem {
  return {
    createdAt: safeDate(row.createdAt ?? row.created_at),
    description: safeString(row.description, ""),
    id: safeString(row.id, "activity"),
    title: safeString(row.title, "Activity"),
    type: safeString(row.type, "activity"),
  };
}

export function mapRecommendationRowToDashboardRecommendation(
  row: DashboardRecommendationRow,
): DashboardRecommendation {
  return {
    companyName: safeString(row.companyName ?? row.company_name, "Company"),
    createdAt: safeDate(row.createdAt ?? row.created_at),
    employmentType: safeString(
      row.employmentType ?? row.employment_type,
      "Role",
    ),
    id: safeString(row.id, "recommendation"),
    location: safeString(row.location, "Location not specified"),
    title: safeString(row.title, "Untitled role"),
  };
}

function createRecruiterStats(
  profile: DashboardProfile,
  counts: RecruiterJobCounts,
  subscription: SubscriptionSnapshot | null,
  applicationDashboard: RecruiterApplicationDashboardData,
) {
  const usedJobSlots = getUsedJobSlots(counts);
  const remainingJobs = subscription
    ? getRemainingJobLimitForUsedJobs(subscription, usedJobSlots)
    : getRemainingJobLimitFromCounts(profile.current_plan, counts);
  const remainingJobsHref =
    remainingJobs === "unlimited" ||
    remainingJobs === "Unlimited" ||
    (typeof remainingJobs === "number" && remainingJobs > 0)
      ? "/post-job"
      : profile.current_plan === "free"
        ? "/pricing"
        : "/dashboard/billing";

  return {
    activeJobs: {
      href: "/jobs?status=active",
      id: "active-jobs",
      title: "Active Jobs",
      supportingText: "Live jobs currently visible to candidates.",
      value: counts.published,
      valueFormat: "number",
    },
    archivedJobs: {
      id: "archived-jobs",
      title: "Archived Jobs",
      value: counts.archived,
      valueFormat: "number",
    },
    closedJobs: {
      href: "/jobs?status=closed",
      id: "closed-jobs",
      title: "Closed Jobs",
      supportingText: "Jobs no longer accepting applications.",
      value: counts.closed,
      valueFormat: "number",
    },
    draftJobs: {
      href: "/jobs?status=draft",
      id: "draft-jobs",
      title: "Draft Jobs",
      supportingText: "Saved privately and ready for editing.",
      value: counts.draft,
      valueFormat: "number",
    },
    hires: {
      href: "/applications",
      icon: "activity",
      id: "hires",
      supportingText: "Applications that reached the hired stage.",
      title: "Hires",
      value: applicationDashboard.error
        ? "Unavailable"
        : applicationDashboard.hires,
      valueFormat: "text",
    },
    interviewsScheduled: {
      href: "/applications",
      icon: "calendar",
      id: "interviews-scheduled",
      supportingText: "Applications currently in the interview stage.",
      title: "Interviews Scheduled",
      value: applicationDashboard.error
        ? "Unavailable"
        : applicationDashboard.interviewsScheduled,
      valueFormat: "text",
    },
    scheduledJobs: {
      badge: {
        description: "Published jobs scheduled for a future public time.",
        label: "Scheduled",
      },
      href: "/jobs?status=scheduled",
      id: "scheduled-jobs",
      title: "Scheduled Jobs",
      supportingText: "Jobs scheduled to publish automatically.",
      value: counts.scheduled,
      valueFormat: "number",
    },
    totalApplications: {
      href: "/applications",
      icon: "applications",
      id: "total-applications",
      supportingText: "Applications received across your jobs.",
      title: "Total Applications",
      value: applicationDashboard.error
        ? "Unavailable"
        : applicationDashboard.totalApplications,
      valueFormat: "text",
    },
    remainingJobLimit: {
      badge:
        remainingJobs === 0
          ? {
              className: "border-yellow-300 bg-yellow-50 text-gray-900",
              description: "Your current plan has no remaining publishing slots.",
              label: "View plan",
            }
          : undefined,
      href: remainingJobsHref,
      id: "remaining-job-limit",
      title: "Remaining Jobs",
      supportingText:
        "Remaining publishing slots available in your current plan.",
      value:
        remainingJobs === "unlimited" || remainingJobs === "Unlimited"
          ? "Unlimited"
          : remainingJobs,
      valueFormat: "text",
    },
  } satisfies RecruiterDashboardData["stats"];
}

function createJobSeekerStats(
  candidateData: CandidateDashboardInput,
) {
  const unavailable = "Unavailable";
  const savedJobsValue = candidateData.savedJobs.error
    ? unavailable
    : candidateData.savedJobs.savedCount;
  const alertsValue = candidateData.jobAlerts.error
    ? unavailable
    : candidateData.jobAlerts.enabledCount;
  const profileValue = candidateData.profile
    ? `${Math.max(0, Math.min(100, candidateData.profile.profile_completion))}%`
    : "0%";

  return {
    activeJobAlerts: {
      href: "/job-alerts",
      id: "active-job-alerts",
      supportingText: "Enabled searches ready to match future roles.",
      title: "Active Job Alerts",
      value: alertsValue,
      valueFormat: "text",
    },
    profileStrength: {
      href: "/settings/profile",
      id: "profile-strength",
      supportingText: "Complete your profile to improve recruiter visibility.",
      title: "Profile Completion",
      value: profileValue,
      valueFormat: "text",
    },
    savedJobs: {
      href: "/saved-jobs",
      id: "saved-jobs",
      supportingText: "Roles you saved to revisit later.",
      title: "Saved Jobs",
      value: savedJobsValue,
      valueFormat: "text",
    },
  } satisfies JobSeekerDashboardData["stats"];
}

export function buildRecruiterDashboardData(
  profile: DashboardProfile,
  recruiterJobs: RecruiterJobsDashboardInput = createEmptyRecruiterJobsDashboardInput(),
): RecruiterDashboardData {
  const subscription = recruiterJobs.subscription;
  const analyticsAccess: SubscriptionAccess = subscription
    ? canViewPremiumAnalytics(subscription)
    : { allowed: false, reason: "feature_unavailable" };
  const currentPlan =
    subscription && isValidPlan(subscription.plan.slug)
      ? subscription.plan.slug
      : profile.current_plan;
  const stats = createRecruiterStats(
    profile,
    recruiterJobs.counts,
    subscription,
    recruiterJobs.applicationDashboard,
  );
  const remainingJobs = subscription
    ? getSubscriptionRemainingJobLimit(subscription)
    : getRemainingJobLimitFromCounts(currentPlan, recruiterJobs.counts);
  const canPost = subscription
    ? canPostJob(subscription).allowed
    : currentPlan !== "free" &&
      (remainingJobs === "Unlimited" ||
        remainingJobs === "unlimited" ||
        (typeof remainingJobs === "number" && remainingJobs > 0));

  return {
    analyticsAccess,
    analytics: recruiterJobs.analytics,
    applicationDashboard: recruiterJobs.applicationDashboard,
    quickActions: [
      canPost
          ? {
            description: "Create a new job listing.",
            href: "/post-job",
            icon: "briefcase",
            id: "post-job",
            title: "Post a Job",
            variant: "primary",
          }
        : {
            description:
              currentPlan === "free"
                ? "Choose a paid plan to unlock job posting."
                : "Upgrade your plan or close jobs to unlock more slots.",
            href: "/pricing",
            icon: "pricing",
            id: "unlock-post-job",
            title: "Unlock Posting",
            variant: "primary",
          },
      {
        description: "Manage your recruiter-owned job posts.",
        href: "/jobs",
        icon: "briefcase",
        id: "manage-jobs",
        title: "Manage Jobs",
        variant: "secondary",
      },
    ],
    recentActivity: [],
    recentJobs: recruiterJobs.recentJobs,
    role: "recruiter",
    sections: {
      primary: {
        description:
          recruiterJobs.recentJobs.length > 0
            ? "Your latest recruiter-owned jobs from Supabase."
            : "Your posted jobs will appear here after you save a draft or submit a job.",
        emptyState: canPost
          ? dashboardEmptyStates.jobs
          : {
              ...dashboardEmptyStates.jobs,
              actionHref: "/pricing",
              actionLabel: "View Pricing",
              description:
                currentPlan === "free"
                  ? "Choose a paid plan to unlock job posting."
                  : "Upgrade your plan or close jobs to unlock more slots.",
            },
        id: "recent-jobs",
        title: "Recent Jobs",
      },
      activity: {
        description:
          "Hiring activity will appear here after jobs and applicants are connected.",
        emptyState: dashboardEmptyStates.activity,
        id: "recent-activity",
        title: "Recent Activity",
      },
    },
    statCards: [
      stats.activeJobs,
      stats.totalApplications,
      stats.interviewsScheduled,
      stats.hires,
    ],
    stats,
    subscription,
    user: {
      ...mapProfileToDashboardUser(profile),
      currentPlan,
    },
  };
}

export function buildJobSeekerDashboardData(
  profile: DashboardProfile,
  candidateData: CandidateDashboardInput = {
    applications: {
      error: null,
      items: [],
      totalCount: 0,
    },
    jobAlerts: {
      enabledCount: 0,
      error: null,
      recentAlerts: [],
      totalCount: 0,
    },
    profile: null,
    recommendations: [],
    recommendationsError: null,
    savedJobs: {
      error: null,
      recentJobs: [],
      savedCount: 0,
    },
  },
): JobSeekerDashboardData {
  const stats = createJobSeekerStats(candidateData);

  return {
    candidateApplications: candidateData.applications.items,
    candidateApplicationsError: candidateData.applications.error,
    candidateRecommendations: candidateData.recommendations,
    candidateRecommendationsError: candidateData.recommendationsError,
    quickActions: [
      {
        description: "Explore open roles.",
        href: "/jobs",
        id: "browse-jobs",
        title: "Browse Jobs",
        variant: "primary",
      },
      {
        description: "Manage the jobs you want to revisit.",
        href: "/saved-jobs",
        id: "saved-jobs",
        title: "Saved Jobs",
        variant: "secondary",
      },
      {
        description: "Keep your matching searches active.",
        href: "/job-alerts",
        id: "job-alerts",
        title: "Job Alerts",
        variant: "secondary",
      },
    ],
    recentActivity: [],
    recommendedJobs: [],
    role: "job_seeker",
    savedJobsSummary: candidateData.savedJobs,
    sections: {
      primary: {
        description: dashboardEmptyStates.recommendations.description,
        emptyState: dashboardEmptyStates.recommendations,
        id: "recommended-jobs",
        title: "Recommended Jobs",
      },
      activity: {
        description: "Your latest applications and their current status.",
        emptyState: dashboardEmptyStates.activity,
        id: "recent-activity",
        title: "Recent Activity",
      },
    },
    statCards: [
      stats.savedJobs,
      stats.activeJobAlerts,
      stats.profileStrength,
    ],
    stats,
    user: mapProfileToDashboardUser(profile),
  };
}

export function buildRoleBasedDashboardData(
  profile: DashboardProfile,
  recruiterJobs?: RecruiterJobsDashboardInput,
  candidateDashboard?: CandidateDashboardInput,
): RoleBasedDashboardData | null {
  if (profile.role_mode === "recruiter") {
    return buildRecruiterDashboardData(profile, recruiterJobs);
  }

  if (profile.role_mode === "job_seeker") {
    return buildJobSeekerDashboardData(profile, candidateDashboard);
  }

  return null;
}
