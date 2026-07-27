import { CONNECTION_ERROR_MESSAGE, logAuthError } from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";

export type ProfileRole = "recruiter" | "job_seeker";

export type ProfileRow = {
  avatar_url: string | null;
  bio: string | null;
  current_plan: string | null;
  department: string | null;
  email: string | null;
  full_name: string | null;
  id: string;
  job_title: string | null;
  linkedin_url: string | null;
  location: string | null;
  profile_completed: boolean | null;
  phone: string | null;
  role_mode: ProfileRole | null;
  recruiter_avatar_path: string | null;
  moderation_status: "active" | "suspended" | "restricted" | null;
};

const profileSelectColumns =
  "id, full_name, email, role_mode, current_plan, profile_completed, avatar_url, moderation_status, job_title, department, phone, location, bio, linkedin_url, recruiter_avatar_path";

export type RecruiterProfileUpdate = {
  bio: string;
  department: string;
  fullName: string;
  jobTitle: string;
  linkedinUrl: string;
  location: string;
  phone: string;
  recruiterAvatarPath: string | null;
};

export function getProfileRedirectPath(
  profile: Pick<ProfileRow, "profile_completed" | "moderation_status"> | null,
) {
  if (profile?.moderation_status === "suspended") {
    return "/account-restricted";
  }

  return profile?.profile_completed ? "/dashboard" : "/onboarding";
}

function logProfileError(context: string, error: unknown) {
  logAuthError(context, error);
}

export async function getProfile(userId: string) {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      profile: null,
    };
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user || userData.user.id !== userId) {
      return {
        error: "We could not verify your account. Please sign in again.",
        profile: null,
      };
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(profileSelectColumns)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      logProfileError("[profiles] fetch failed", error);

      return {
        error: "We could not load your profile. Please try again.",
        profile: null,
      };
    }

    return {
      error: null,
      profile: data as ProfileRow | null,
    };
  } catch (error) {
    logProfileError("[profiles] fetch network failure", error);

    return {
      error: CONNECTION_ERROR_MESSAGE,
      profile: null,
    };
  }
}

export async function ensureProfile({
  email,
  fullName,
  userId,
}: {
  email: string;
  fullName: string;
  userId: string;
}) {
  if (!supabase) {
    return "Supabase is not configured. Please check your environment variables.";
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user || userData.user.id !== userId) {
      return "We could not verify your account. Please sign in again.";
    }

    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
      full_name: fullName,
      email,
      role_mode: null,
      current_plan: "free",
      profile_completed: false,
      avatar_url: null,
    });

    if (!insertError || insertError.code === "23505") {
      return null;
    }

    logProfileError("[profiles] insert failed", insertError);

    return "Your account was created, but we could not set up your profile. Please try again.";
  } catch (error) {
    logProfileError("[profiles] insert network failure", error);
    return CONNECTION_ERROR_MESSAGE;
  }
}

export async function updateProfileRole({
  role,
  userId,
}: {
  role: ProfileRole;
  userId: string;
}) {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      profile: null,
    };
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user || userData.user.id !== userId) {
      return {
        error: "We could not verify your account. Please sign in again.",
        profile: null,
      };
    }

    const { data, error } = await supabase.rpc("switch_own_role", {
      p_role: role,
    });

    if (error) {
      logProfileError("[profiles] role update failed", error);

      return {
        error: "We could not switch your role. Please try again.",
        profile: null,
      };
    }

    if (!data || typeof data !== "object") {
      return {
        error:
          "We could not find your profile. Please sign in again and try once more.",
        profile: null,
      };
    }

    return {
      error: null,
      profile: data as ProfileRow,
    };
  } catch (error) {
    logProfileError("[profiles] role update network failure", error);

    return {
      error: CONNECTION_ERROR_MESSAGE,
      profile: null,
    };
  }
}

export async function updateRecruiterProfile({
  profile,
}: {
  profile: RecruiterProfileUpdate;
}) {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      profile: null,
    };
  }

  try {
    const { data, error } = await supabase.rpc("update_recruiter_profile", {
      p_bio: profile.bio.trim() || null,
      p_department: profile.department.trim() || null,
      p_full_name: profile.fullName.trim(),
      p_job_title: profile.jobTitle.trim() || null,
      p_linkedin_url: profile.linkedinUrl.trim() || null,
      p_location: profile.location.trim() || null,
      p_phone: profile.phone.trim() || null,
      p_recruiter_avatar_path: profile.recruiterAvatarPath,
    });

    if (error) {
      logProfileError("[profiles] recruiter settings update failed", error);
      return {
        error: "We could not save your recruiter profile. Please try again.",
        profile: null,
      };
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return {
        error: "Only an authenticated recruiter can update this profile.",
        profile: null,
      };
    }

    return {
      error: null,
      profile: row as ProfileRow,
    };
  } catch (error) {
    logProfileError("[profiles] recruiter settings update network failure", error);
    return {
      error: CONNECTION_ERROR_MESSAGE,
      profile: null,
    };
  }
}
