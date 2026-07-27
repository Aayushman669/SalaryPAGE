export const adminSections = [
  "overview",
  "users",
  "companies",
  "jobs",
  "applications",
  "payments",
  "moderation",
] as const;

export type AdminSection = (typeof adminSections)[number];

export const adminAnalyticsRanges = ["today", "7d", "30d", "90d", "all"] as const;

export type AdminAnalyticsRange = (typeof adminAnalyticsRanges)[number];

export type AdminPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminOverview = {
  counts: {
    activeJobs: number;
    activePaidUsers: number;
    users: number;
    candidates: number;
    recruiters: number;
    companies: number;
    jobs: number;
    draftJobs: number;
    applications: number;
    successfulPayments: number;
    totalRevenue: number;
  };
  analytics: AdminAnalyticsSnapshot;
  recent: {
    users: AdminUser[];
    companies: AdminCompany[];
    jobs: AdminJob[];
    applications: AdminApplication[];
    payments: AdminPayment[];
  };
};

export type AdminRankedItem = {
  id: string;
  name: string;
  value: number;
};

export type AdminPlanRevenue = {
  slug: string;
  name: string;
  revenue: number;
};

export type AdminAnalyticsSnapshot = {
  range: AdminAnalyticsRange;
  counts: {
    activeJobs: number;
    activePaidUsers: number;
    users: number;
    candidates: number;
    recruiters: number;
    companies: number;
    jobs: number;
    draftJobs: number;
    applications: number;
    successfulPayments: number;
    totalRevenue: number;
  };
  growth: {
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    newUsersSelected: number;
    newJobsSelected: number;
    newApplicationsSelected: number;
    newCompaniesSelected: number;
  };
  revenue: {
    selected: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    byPlan: AdminPlanRevenue[];
  };
  planDistribution: Record<"starter" | "growth" | "pro", number>;
  topCompanies: {
    mostJobs: AdminRankedItem[];
    mostApplications: AdminRankedItem[];
    highestHiringActivity: AdminRankedItem[];
  };
  topRecruiters: {
    jobsPosted: AdminRankedItem[];
    applicationsReceived: AdminRankedItem[];
  };
};

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  profileCompleted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  avatarUrl: string | null;
  moderationStatus: string;
};

export type AdminCompany = {
  id: string;
  name: string;
  slug: string;
  logoPath: string | null;
  industry: string | null;
  recruiterName: string;
  recruiterEmail: string;
  verificationStatus: string;
  profileCompletion: number;
  activeJobCount: number;
  totalJobCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  moderationStatus: string;
};

export type AdminJob = {
  id: string;
  title: string;
  slug: string | null;
  companyName: string;
  companyId: string | null;
  recruiterName: string;
  recruiterEmail: string;
  status: string;
  featured: boolean;
  applicationsCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  publishedAt: string | null;
  moderationStatus: string;
};

export type AdminApplication = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  status: string;
  resumeAvailable: boolean;
  coverLetterAvailable: boolean;
  appliedAt: string | null;
  updatedAt: string | null;
  moderationStatus: string;
};

export type AdminPayment = {
  id: string;
  recruiterName: string;
  recruiterEmail: string;
  planName: string;
  amount: number;
  currency: string;
  status: string;
  paymentReference: string | null;
  orderReference: string | null;
  subscriptionStatus: string | null;
  purchasedAt: string | null;
  moderationStatus: string;
};

export type AdminModerationAction = {
  id: string;
  adminId: string;
  adminLabel: string;
  targetType: "user" | "company" | "job" | "application" | "payment";
  targetId: string;
  targetLabel: string;
  actionType: string;
  reason: string;
  internalNote: string;
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  createdAt: string;
  reversedAt: string | null;
  reversedBy: string | null;
};

export type AdminListResponse<T> = {
  data: T[];
  pagination: AdminPagination;
};

export type AdminOverviewResponse = {
  data: AdminOverview;
};
