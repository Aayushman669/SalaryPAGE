import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JobViewRouteContext = {
  params: Promise<{ slug: string }>;
};

function normalizeSlug(value: string) {
  try {
    const slug = decodeURIComponent(value).trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-]{0,159}$/.test(slug) ? slug : "";
  } catch {
    return "";
  }
}

function createViewCookieName(slug: string) {
  const encodedSlug = Buffer.from(slug)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, 90);

  return `jbv_${encodedSlug}`;
}

function logViewTrackingError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  if (!error || typeof error !== "object") {
    console.error(context, error);
    return;
  }

  const errorRecord = error as {
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    message?: unknown;
  };

  console.error(context, {
    code: errorRecord.code,
    details: errorRecord.details,
    hint: errorRecord.hint,
    message: errorRecord.message,
  });
}

export async function POST(
  request: NextRequest,
  { params }: JobViewRouteContext,
) {
  const throttled = rateLimitResponse(enforceRateLimit(request, {
    max: 60,
    scope: "api:jobs:view",
    windowMs: 60_000,
  }));

  if (throttled) return throttled;

  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);

  if (!slug) {
    return NextResponse.json(
      { error: "Invalid job slug.", tracked: false },
      { status: 400 },
    );
  }

  const cookieName = createViewCookieName(slug);

  if (request.cookies.has(cookieName)) {
    return NextResponse.json({ tracked: false, throttled: true });
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      { error: "View tracking is not configured.", tracked: false },
      { status: 503 },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "View tracking is not configured.", tracked: false },
      { status: 503 },
    );
  }

  const { data, error } = await supabase.rpc("track_public_job_view", {
    job_slug: slug,
  });

  if (error) {
    logViewTrackingError("[job-view] view tracking failed", error);

    return NextResponse.json(
      { error: "View tracking failed.", tracked: false },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ tracked: data === true });

  if (data === true) {
    response.cookies.set({
      httpOnly: true,
      maxAge: 60 * 60,
      name: cookieName,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      value: "1",
    });
  }

  return response;
}
