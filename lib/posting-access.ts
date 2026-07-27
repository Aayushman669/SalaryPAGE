import {
  getRemainingJobLimitFromCounts,
  isValidPlan,
  isValidRole,
  type DashboardPlan,
  type RecruiterJobCounts,
} from "@/lib/dashboard-data";
import type { ProfileRow } from "@/lib/auth-profiles";

export type PostingAccess = {
  allowed: boolean;
  reason: "allowed" | "not_recruiter" | "unpaid" | "limit_reached";
};

export function normalizePostingPlan(plan: string | null | undefined): DashboardPlan {
  const normalizedPlan = plan ?? null;

  return isValidPlan(normalizedPlan) ? normalizedPlan : "free";
}

export function hasPaidPostingPlan(plan: string | null | undefined) {
  return normalizePostingPlan(plan) !== "free";
}

export function canProfileAccessPostJob(profile: Pick<ProfileRow, "current_plan" | "role_mode"> | null) {
  return Boolean(
    profile &&
      isValidRole(profile.role_mode) &&
      profile.role_mode === "recruiter" &&
      hasPaidPostingPlan(profile.current_plan),
  );
}

export function getPostingAccess({
  counts,
  profile,
}: {
  counts?: RecruiterJobCounts;
  profile: Pick<ProfileRow, "current_plan" | "role_mode"> | null;
}): PostingAccess {
  if (!profile || profile.role_mode !== "recruiter") {
    return {
      allowed: false,
      reason: "not_recruiter",
    };
  }

  if (!hasPaidPostingPlan(profile.current_plan)) {
    return {
      allowed: false,
      reason: "unpaid",
    };
  }

  if (counts) {
    const remaining = getRemainingJobLimitFromCounts(
      normalizePostingPlan(profile.current_plan),
      counts,
    );

    if (remaining !== "Unlimited" && remaining <= 0) {
      return {
        allowed: false,
        reason: "limit_reached",
      };
    }
  }

  return {
    allowed: true,
    reason: "allowed",
  };
}
