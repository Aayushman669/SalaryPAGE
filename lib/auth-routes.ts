export const protectedRoutePrefixes = [
  "/admin",
  "/account-restricted",
  "/dashboard",
  "/dashboard/billing",
  "/applications",
  "/interviews",
  "/post-job",
  "/onboarding",
  "/notifications",
  "/settings",
  "/jobs/create",
  "/recruiter",
  "/job-seeker",
  "/saved-jobs",
  "/job-alerts",
  "/success",
];

export const authRoutePrefixes = ["/login", "/signup"];

export function matchesRoute(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedRoute(pathname: string) {
  return protectedRoutePrefixes.some((prefix) => matchesRoute(pathname, prefix));
}

export function isAuthRoute(pathname: string) {
  return authRoutePrefixes.some((prefix) => matchesRoute(pathname, prefix));
}

export function isAdminAuthMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  const role = (metadata as { role?: unknown }).role;

  return role === "admin" || role === "super_admin";
}

export function getSafeProtectedNextPath(nextPath?: string | null) {
  if (!nextPath) {
    return null;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(nextPath, "http://localhost");
  } catch {
    return null;
  }

  if (parsedUrl.origin !== "http://localhost") {
    return null;
  }

  if (nextPath.includes("\\") || /[\u0000-\u001f\u007f]/.test(nextPath)) {
    return null;
  }

  const pathWithSearch = `${parsedUrl.pathname}${parsedUrl.search}`;

  if (
    parsedUrl.pathname === "/onboarding" ||
    isAuthRoute(parsedUrl.pathname) ||
    !isProtectedRoute(parsedUrl.pathname)
  ) {
    return null;
  }

  return pathWithSearch;
}
