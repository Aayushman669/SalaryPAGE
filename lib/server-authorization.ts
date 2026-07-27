import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/admin-auth";
import {
  getAuthenticatedApiUser,
  type AuthenticatedApiUser,
} from "@/lib/api-auth";

export type TrustedRole = "admin" | "super_admin" | "recruiter" | "job_seeker";

export type TrustedProfile = {
  full_name: string | null;
  moderation_status: "active" | "restricted" | "suspended" | null;
  profile_completed: boolean | null;
  role_mode: string | null;
};

export type TrustedActor = {
  profile: TrustedProfile | null;
  role: TrustedRole;
  user: User;
};

function isProfileRole(value: string | null): value is "recruiter" | "job_seeker" {
  return value === "recruiter" || value === "job_seeker";
}

export async function resolveTrustedActor(
  user: User,
  database: SupabaseClient,
): Promise<TrustedActor | null> {
  if (isAdminUser(user)) {
    const role = user.app_metadata?.role;

    return {
      profile: null,
      role: role === "super_admin" ? "super_admin" : "admin",
      user,
    };
  }

  const { data, error } = await database
    .from("profiles")
    .select("full_name, role_mode, profile_completed, moderation_status")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const profile = data as TrustedProfile;

  if (
    profile.profile_completed !== true ||
    profile.moderation_status === "suspended" ||
    !isProfileRole(profile.role_mode)
  ) {
    return null;
  }

  return {
    profile,
    role: profile.role_mode,
    user,
  };
}

export async function resolveTrustedRole(
  user: User,
  database: SupabaseClient,
): Promise<TrustedRole | null> {
  const actor = await resolveTrustedActor(user, database);
  return actor?.role ?? null;
}

export async function getTrustedApiActor(
  request: Request,
): Promise<(AuthenticatedApiUser & TrustedActor) | null> {
  const auth = await getAuthenticatedApiUser(request);

  if (!auth) {
    return null;
  }

  const actor = await resolveTrustedActor(auth.user, auth.supabase);

  if (!actor) {
    return null;
  }

  return { ...auth, ...actor };
}

export function hasTrustedRole(
  actor: TrustedActor | null,
  roles: readonly TrustedRole[],
) {
  return actor !== null && roles.includes(actor.role);
}
