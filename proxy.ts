import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  isAdminAuthMetadata,
  matchesRoute,
} from "@/lib/auth-routes";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type ProfileAccess = {
  moderation_status: string | null;
  profile_completed: boolean | null;
  role_mode: string | null;
};

function isAdminRoute(pathname: string) {
  return matchesRoute(pathname, "/admin");
}

function isAccountRestrictedRoute(pathname: string) {
  return matchesRoute(pathname, "/account-restricted");
}

function requiredRole(pathname: string) {
  if (
    [
      "/dashboard/billing",
      "/interviews",
      "/jobs/create",
      "/post-job",
      "/recruiter",
      "/success",
    ].some((prefix) => matchesRoute(pathname, prefix))
  ) {
    return "recruiter";
  }

  if (
    ["/job-alerts", "/job-seeker", "/saved-jobs"].some((prefix) =>
      matchesRoute(pathname, prefix),
    )
  ) {
    return "job_seeker";
  }

  return null;
}

function createLoginPath(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  loginUrl.searchParams.set("next", nextPath);

  return `${loginUrl.pathname}${loginUrl.search}`;
}

function copyAuthResponseState(
  request: NextRequest,
  response: NextResponse,
  path: string,
) {
  const redirectResponse = NextResponse.redirect(new URL(path, request.url));

  response.cookies.getAll().forEach(({ name, value }) => {
    redirectResponse.cookies.set(name, value);
  });

  for (const [name, value] of response.headers) {
    if (
      name === "cache-control" ||
      name === "expires" ||
      name === "pragma"
    ) {
      redirectResponse.headers.set(name, value);
    }
  }

  return redirectResponse;
}

function createAuthClient(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");

  const client = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        response.headers.set("Cache-Control", "private, no-store, max-age=0");

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  return {
    client,
    getResponse: () => response,
  };
}

export async function proxy(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/login?error=configuration", request.url));
  }

  const { client, getResponse } = createAuthClient(request);
  const { data, error } = await client.auth.getUser();
  const response = getResponse();

  if (error || !data.user) {
    return copyAuthResponseState(request, response, createLoginPath(request));
  }

  const pathname = request.nextUrl.pathname;

  if (isAccountRestrictedRoute(pathname)) {
    return response;
  }

  if (isAdminRoute(pathname) && !isAdminAuthMetadata(data.user.app_metadata)) {
    const { data: profile } = await client
      .from("profiles")
      .select("profile_completed")
      .eq("id", data.user.id)
      .maybeSingle();
    const nextPath = (profile as Pick<ProfileAccess, "profile_completed"> | null)
      ?.profile_completed
      ? "/dashboard"
      : "/onboarding";

    return copyAuthResponseState(request, response, nextPath);
  }

  if (isAdminRoute(pathname)) {
    return response;
  }

  const { data: profileData, error: profileError } = await client
    .from("profiles")
    .select("moderation_status, profile_completed, role_mode")
    .eq("id", data.user.id)
    .maybeSingle();
  const profile = profileData as ProfileAccess | null;

  if (profileError) {
    return copyAuthResponseState(request, response, "/account-restricted");
  }

  if (!profile) {
    return copyAuthResponseState(request, response, "/onboarding");
  }

  if (
    profile.moderation_status === "suspended" &&
    !isAccountRestrictedRoute(pathname)
  ) {
    return copyAuthResponseState(request, response, "/account-restricted");
  }

  if (!profile.profile_completed && !matchesRoute(pathname, "/onboarding")) {
    return copyAuthResponseState(request, response, "/onboarding");
  }

  if (profile.profile_completed && matchesRoute(pathname, "/onboarding")) {
    return copyAuthResponseState(request, response, "/dashboard");
  }

  const expectedRole = requiredRole(pathname);

  if (expectedRole && profile.role_mode !== expectedRole) {
    return copyAuthResponseState(request, response, "/dashboard");
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/account-restricted/:path*",
    "/dashboard/:path*",
    "/applications/:path*",
    "/interviews/:path*",
    "/post-job/:path*",
    "/onboarding/:path*",
    "/notifications/:path*",
    "/settings/:path*",
    "/jobs/create/:path*",
    "/recruiter/:path*",
    "/job-seeker/:path*",
    "/saved-jobs/:path*",
    "/job-alerts/:path*",
    "/success/:path*",
  ],
};
