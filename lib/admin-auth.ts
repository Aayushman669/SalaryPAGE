import "server-only";

import type { User } from "@supabase/supabase-js";
import { getAuthenticatedApiUser, type AuthenticatedApiUser } from "@/lib/api-auth";

const adminRoles = new Set(["admin", "super_admin"]);

export function isAdminUser(user: User | null | undefined) {
  const role = user?.app_metadata?.role;
  return typeof role === "string" && adminRoles.has(role);
}

export async function getAdminApiUser(request: Request): Promise<AuthenticatedApiUser | null> {
  const auth = await getAuthenticatedApiUser(request);
  return auth && isAdminUser(auth.user) ? auth : null;
}

export function isKnownAdminRole(value: unknown): value is "admin" | "super_admin" {
  return typeof value === "string" && adminRoles.has(value);
}
