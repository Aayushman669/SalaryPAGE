"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ensureProfile,
  getProfile,
  type ProfileRow,
} from "@/lib/auth-profiles";
import { CONNECTION_ERROR_MESSAGE, logAuthError } from "@/lib/auth-errors";
import {
  buildRoleBasedDashboardData,
  isValidRole,
  normalizeDashboardProfile,
  createEmptyRecruiterJobsDashboardInput,
  type DashboardProfile,
  type DashboardPanelGroup,
  type DashboardQuickActionItem,
  type RecruiterJobsDashboardInput,
  type DashboardStat,
  type RoleBasedDashboardData,
} from "@/lib/dashboard-data";
import {
  createEmptyCandidateDashboardApplications,
  loadCandidateDashboardApplications,
  loadCandidateDashboardRecommendations,
  type CandidateDashboardApplications,
} from "@/lib/candidate-dashboard";
import {
  getCandidateProfile,
  type CandidateProfile,
} from "@/lib/candidate-profile";
import type { PublicJobListItem } from "@/lib/public-jobs";
import { loadRecruiterDashboardJobs } from "@/lib/dashboard-jobs";
import { getCompanyProfile, type CompanyProfile } from "@/lib/company-profile";
import { supabase } from "@/lib/supabase";
import {
  createEmptyCandidateSavedJobsSummary,
  loadCandidateSavedJobsSummary,
  type CandidateSavedJobsSummary,
} from "@/lib/saved-jobs";
import {
  createEmptyCandidateJobAlertsSummary,
  loadCandidateJobAlertsSummary,
  type JobAlertsSummary,
} from "@/lib/job-alerts";

type UseDashboardDataArgs = {
  isAuthLoading: boolean;
  isLoggedIn: boolean;
};

type DashboardDataState = {
  candidateApplications: CandidateDashboardApplications;
  candidateSavedJobs: CandidateSavedJobsSummary;
  candidateJobAlerts: JobAlertsSummary;
  candidateProfile: CandidateProfile | null;
  candidateProfileError: string | null;
  candidateRecommendations: PublicJobListItem[];
  candidateRecommendationsError: string | null;
  company: CompanyProfile | null;
  error: string;
  loading: boolean;
  profile: DashboardProfile | null;
  recruiterJobs: RecruiterJobsDashboardInput | null;
};

function createEmptyCandidateDashboardFields() {
  return {
    candidateApplications: createEmptyCandidateDashboardApplications(),
    candidateJobAlerts: createEmptyCandidateJobAlertsSummary(),
    candidateProfile: null,
    candidateProfileError: null,
    candidateRecommendations: [],
    candidateRecommendationsError: null,
    candidateSavedJobs: createEmptyCandidateSavedJobsSummary(),
  };
}

type CachedDashboardProfile = {
  profile: DashboardProfile;
  userId: string;
};

const DASHBOARD_ERROR_MESSAGE =
  "We could not load your dashboard profile. Please try again.";
const DASHBOARD_REQUEST_TIMEOUT_MS = 12_000;

let cachedDashboardProfile: CachedDashboardProfile | null = null;

export const dashboardProfileChangedEvent =
  "job-board:dashboard-profile-changed";

export function clearDashboardProfileCache() {
  cachedDashboardProfile = null;
}

function readFullNameFromMetadata(metadata: Record<string, unknown> | undefined) {
  return typeof metadata?.full_name === "string" ? metadata.full_name : "";
}

function createProfileCache(userId: string, profile: DashboardProfile) {
  cachedDashboardProfile = {
    profile,
    userId,
  };
}

function withTimeoutFallback<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs = DASHBOARD_REQUEST_TIMEOUT_MS,
) {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, timeoutMs);

    promise.then(
      (value) => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      () => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutId);
        resolve(fallback);
      },
    );
  });
}

export function notifyDashboardProfileChanged(profile: DashboardProfile) {
  createProfileCache(profile.id, profile);

  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<{ profile: DashboardProfile }>(
      dashboardProfileChangedEvent,
      {
        detail: { profile },
      },
    ),
  );
}

function readProfileCache(userId: string) {
  if (cachedDashboardProfile?.userId !== userId) {
    return null;
  }

  return cachedDashboardProfile.profile;
}

async function loadProfileRow({
  email,
  fullName,
  userId,
}: {
  email: string;
  fullName: string;
  userId: string;
}) {
  const cachedProfile = readProfileCache(userId);

  if (cachedProfile) {
    return {
      error: null,
      profile: cachedProfile,
    };
  }

  const initialProfileResult = await getProfile(userId);

  if (initialProfileResult.error) {
    return initialProfileResult;
  }

  if (initialProfileResult.profile) {
    const normalizedProfile = normalizeDashboardProfile(
      initialProfileResult.profile,
    );

    if (normalizedProfile) {
      createProfileCache(userId, normalizedProfile);
    }

    return {
      error: null,
      profile: normalizedProfile,
    };
  }

  const profileCreationError = await ensureProfile({
    email,
    fullName,
    userId,
  });

  if (profileCreationError) {
    return {
      error: profileCreationError,
      profile: null,
    };
  }

  const createdProfileResult = await getProfile(userId);

  if (createdProfileResult.error) {
    return createdProfileResult;
  }

  const normalizedProfile = normalizeDashboardProfile(
    createdProfileResult.profile as ProfileRow | null,
  );

  if (normalizedProfile) {
    createProfileCache(userId, normalizedProfile);

    return {
      error: null,
      profile: normalizedProfile,
    };
  }

  return {
    error: DASHBOARD_ERROR_MESSAGE,
    profile: null,
  };
}

export function useDashboardData({
  isAuthLoading,
  isLoggedIn,
}: UseDashboardDataArgs): {
  candidateJobAlerts: JobAlertsSummary;
  candidateProfile: CandidateProfile | null;
  candidateProfileError: string | null;
  dashboardData: RoleBasedDashboardData | null;
  dashboardStats: DashboardStat[];
  error: string;
  company: CompanyProfile | null;
  loading: boolean;
  profile: DashboardProfile | null;
  quickActions: DashboardQuickActionItem[];
  recentActivity: DashboardPanelGroup | null;
  retry: () => void;
} {
  const [state, setState] = useState<DashboardDataState>({
    ...createEmptyCandidateDashboardFields(),
    company: null,
    error: "",
    loading: true,
    profile: null,
    recruiterJobs: null,
  });
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => {
    clearDashboardProfileCache();
    setRetryKey((currentKey) => currentKey + 1);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleProfileChanged(event: Event) {
      const nextProfile = (
        event as CustomEvent<{ profile?: DashboardProfile }>
      ).detail?.profile;

      if (!nextProfile) {
        return;
      }

      setState((currentState) => {
        if (
          currentState.profile &&
          currentState.profile.id !== nextProfile.id
        ) {
          return currentState;
        }

        return {
          candidateApplications:
            nextProfile.role_mode === "job_seeker"
              ? currentState.candidateApplications
              : createEmptyCandidateDashboardApplications(),
          candidateSavedJobs:
            nextProfile.role_mode === "job_seeker"
              ? currentState.candidateSavedJobs
              : createEmptyCandidateSavedJobsSummary(),
          candidateJobAlerts:
            nextProfile.role_mode === "job_seeker"
              ? currentState.candidateJobAlerts
              : createEmptyCandidateJobAlertsSummary(),
          candidateProfile:
            nextProfile.role_mode === "job_seeker"
              ? currentState.candidateProfile
              : null,
          candidateProfileError: null,
          candidateRecommendations:
            nextProfile.role_mode === "job_seeker"
              ? currentState.candidateRecommendations
              : [],
          candidateRecommendationsError: null,
          company:
            nextProfile.role_mode === "recruiter"
              ? currentState.company
              : null,
          error: "",
          loading: false,
          profile: nextProfile,
          recruiterJobs:
            nextProfile.role_mode === "recruiter"
              ? currentState.recruiterJobs
              : null,
        };
      });
    }

    window.addEventListener(
      dashboardProfileChangedEvent,
      handleProfileChanged,
    );

    return () => {
      window.removeEventListener(
        dashboardProfileChangedEvent,
        handleProfileChanged,
      );
    };
  }, []);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isLoggedIn) {
      const loggedOutStateId = window.setTimeout(() => {
        setState({
          ...createEmptyCandidateDashboardFields(),
          company: null,
          error: "",
          loading: false,
          profile: null,
          recruiterJobs: null,
        });
      }, 0);

      return () => {
        window.clearTimeout(loggedOutStateId);
      };
    }

    let isMounted = true;

    async function loadDashboardData() {
      await Promise.resolve();

      if (!isMounted) {
        return;
      }

      setState((currentState) => ({
        ...currentState,
        error: "",
        loading: true,
      }));

      if (!supabase) {
        setState({
          ...createEmptyCandidateDashboardFields(),
          company: null,
          error:
            "Supabase is not configured. Please check your environment variables.",
          loading: false,
          profile: null,
          recruiterJobs: null,
        });
        return;
      }

      try {
        const { data, error } = await supabase.auth.getUser();

        if (!isMounted) {
          return;
        }

        if (error) {
          logAuthError("[dashboard] user lookup failed", error);
          setState({
            ...createEmptyCandidateDashboardFields(),
            company: null,
            error: "We could not load your session. Please try again.",
            loading: false,
            profile: null,
            recruiterJobs: null,
          });
          return;
        }

        if (!data.user) {
          setState({
            ...createEmptyCandidateDashboardFields(),
            company: null,
            error: "",
            loading: false,
            profile: null,
            recruiterJobs: null,
          });
          return;
        }

        const profileResult = await loadProfileRow({
          email: data.user.email ?? "",
          fullName: readFullNameFromMetadata(data.user.user_metadata),
          userId: data.user.id,
        });

        if (!isMounted) {
          return;
        }

        if (profileResult.error) {
          setState({
            ...createEmptyCandidateDashboardFields(),
            company: null,
            error: profileResult.error,
            loading: false,
            profile: null,
            recruiterJobs: null,
          });
          return;
        }

        const isCandidate = profileResult.profile?.role_mode === "job_seeker";
        const isRecruiter = profileResult.profile?.role_mode === "recruiter";
        const recruiterJobsRequest = isRecruiter
          ? withTimeoutFallback(
              loadRecruiterDashboardJobs(data.user.id),
              {
                data: null,
                error: CONNECTION_ERROR_MESSAGE,
              },
            )
          : Promise.resolve({ data: null, error: null });
        const companyRequest = isRecruiter
          ? withTimeoutFallback(
              getCompanyProfile(data.user.id),
              {
                company: null,
                error: CONNECTION_ERROR_MESSAGE,
              },
            )
          : Promise.resolve({ company: null, error: null });

        const [candidateProfileResult, candidateSavedJobs, candidateJobAlerts, candidateApplications] =
          isCandidate
            ? await Promise.all([
                getCandidateProfile(),
                loadCandidateSavedJobsSummary(),
                loadCandidateJobAlertsSummary(),
                loadCandidateDashboardApplications(),
              ])
            : [
                { candidateProfile: null, error: null },
                createEmptyCandidateSavedJobsSummary(),
                createEmptyCandidateJobAlertsSummary(),
                createEmptyCandidateDashboardApplications(),
              ];

        const candidateRecommendationsResult = isCandidate
          ? await loadCandidateDashboardRecommendations(
              candidateProfileResult.candidateProfile,
            )
          : { error: null, jobs: [] };

        if (candidateSavedJobs.error && process.env.NODE_ENV === "development") {
          console.warn("[dashboard] saved jobs summary unavailable", candidateSavedJobs.error);
        }

        if (candidateJobAlerts.error && process.env.NODE_ENV === "development") {
          console.warn("[dashboard] job alerts summary unavailable", candidateJobAlerts.error);
        }

        if (candidateApplications.error && process.env.NODE_ENV === "development") {
          console.warn(
            "[dashboard] applications summary unavailable",
            candidateApplications.error,
          );
        }

        if (candidateProfileResult.error && process.env.NODE_ENV === "development") {
          console.warn(
            "[dashboard] candidate profile unavailable",
            candidateProfileResult.error,
          );
        }

        const [recruiterJobsResult, companyResult] = await Promise.all([
          recruiterJobsRequest,
          companyRequest,
        ]);

        if (!isMounted) {
          return;
        }

        if (recruiterJobsResult.error && isRecruiter) {
          // The recruiter shell can still render its controls and empty states
          // when an optional dashboard aggregate is unavailable. Keep the
          // error in the console for diagnosis without blocking the route.
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "[dashboard] recruiter aggregates unavailable; using empty dashboard data",
              recruiterJobsResult.error,
            );
          }
        }

        const recruiterJobs = isRecruiter
          ? recruiterJobsResult.data ?? createEmptyRecruiterJobsDashboardInput()
          : recruiterJobsResult.data;

        setState({
          candidateApplications,
          candidateJobAlerts,
          candidateSavedJobs,
          candidateProfile: candidateProfileResult.candidateProfile,
          candidateProfileError: candidateProfileResult.error,
          candidateRecommendations: candidateRecommendationsResult.jobs,
          candidateRecommendationsError: candidateRecommendationsResult.error,
          company: companyResult.company,
          error: "",
          loading: false,
          profile: profileResult.profile,
          recruiterJobs,
        });
      } catch (error) {
        logAuthError("[dashboard] unexpected profile load failure", error);

        if (!isMounted) {
          return;
        }

        setState({
          ...createEmptyCandidateDashboardFields(),
          company: null,
          error:
            error instanceof TypeError
              ? CONNECTION_ERROR_MESSAGE
              : DASHBOARD_ERROR_MESSAGE,
          loading: false,
          profile: null,
          recruiterJobs: null,
        });
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, isLoggedIn, retryKey]);

  const dashboardData = useMemo(() => {
    if (!state.profile || !isValidRole(state.profile.role_mode)) {
      return {
        dashboardData: null,
        dashboardStats: [],
        quickActions: [],
        recentActivity: null,
      };
    }

    const roleData = buildRoleBasedDashboardData(
      state.profile,
      state.recruiterJobs ?? undefined,
      {
        applications: state.candidateApplications,
        jobAlerts: state.candidateJobAlerts,
        profile: state.candidateProfile,
        recommendations: state.candidateRecommendations,
        recommendationsError: state.candidateRecommendationsError,
        savedJobs: state.candidateSavedJobs,
      },
    );

    return {
      dashboardData: roleData,
      dashboardStats: roleData?.statCards ?? [],
      quickActions: roleData?.quickActions ?? [],
      recentActivity: roleData?.sections ?? null,
    };
  }, [
    state.candidateApplications,
    state.candidateJobAlerts,
    state.candidateProfile,
    state.candidateRecommendations,
    state.candidateRecommendationsError,
    state.candidateSavedJobs,
    state.profile,
    state.recruiterJobs,
  ]);

  return {
    candidateJobAlerts: state.candidateJobAlerts,
    candidateProfile: state.candidateProfile,
    candidateProfileError: state.candidateProfileError,
    company: state.company,
    dashboardData: dashboardData.dashboardData,
    dashboardStats: dashboardData.dashboardStats,
    error: state.error,
    loading: state.loading,
    profile: state.profile,
    quickActions: dashboardData.quickActions,
    recentActivity: dashboardData.recentActivity,
    retry,
  };
}
