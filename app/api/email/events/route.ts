import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getAuthenticatedApiUser } from "@/lib/api-auth";
import { EmailService } from "@/lib/email/service";
import type { ClientEmailEventRequest } from "@/lib/email/types";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasOnlyKeys, readJsonBody } from "@/lib/api-security";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JobEmailRow = {
  company_name: string | null;
  created_by: string | null;
  id: string;
  publish_at: string | null;
  slug: string | null;
  status: string | null;
  title: string | null;
};

type ProfileEmailRow = {
  email: string | null;
  full_name: string | null;
  id: string;
};

function getMetadataFullName(user: User) {
  return typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : "";
}

function getJobUrl(slug: string | null | undefined) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  return siteUrl && slug ? `${siteUrl}/jobs/${slug}` : "";
}

function isClientEmailEventRequest(
  value: unknown,
): value is ClientEmailEventRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as Partial<ClientEmailEventRequest>;

  if (event.type === "account_created" || event.type === "password_reset") {
    return true;
  }

  return (
    (event.type === "job_published" ||
      event.type === "job_scheduled" ||
      event.type === "job_submitted") &&
    typeof event.jobId === "string" &&
    event.jobId.length > 0
  );
}

async function getProfile({
  fallbackEmail,
  fallbackFullName,
  userId,
}: {
  fallbackEmail: string;
  fallbackFullName: string;
  userId: string;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      email: fallbackEmail,
      fullName: fallbackFullName,
      userId,
    };
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", userId)
    .maybeSingle();
  const profile = data as ProfileEmailRow | null;

  return {
    email: profile?.email ?? fallbackEmail,
    fullName: profile?.full_name ?? fallbackFullName,
    userId,
  };
}

async function getOwnedJob({
  jobId,
  userId,
}: {
  jobId: string;
  userId: string;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, company_name, status, publish_at, slug, created_by")
    .eq("id", jobId)
    .eq("created_by", userId)
    .maybeSingle();

  if (error && process.env.NODE_ENV === "development") {
    console.error("[email-events] job lookup failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }

  return data as JobEmailRow | null;
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return Response.json(
      { error: "Email queue is not configured." },
      { status: 500 },
    );
  }

  const authenticated = await getAuthenticatedApiUser(request);

  if (!authenticated) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const throttled = rateLimitResponse(enforceRateLimit(request, {
    identity: authenticated.user.id,
    max: 20,
    scope: "api:email:events",
    windowMs: 60_000,
  }));

  if (throttled) return throttled;

  const parsedBody = await readJsonBody(request, 16 * 1024);
  if (!parsedBody.ok) {
    return Response.json(
      { error: parsedBody.reason === "too_large" ? "Request is too large." : "Invalid email event." },
      { status: 400 },
    );
  }

  if (
    !parsedBody.data ||
    typeof parsedBody.data !== "object" ||
    Array.isArray(parsedBody.data)
  ) {
    return Response.json({ error: "Invalid email event." }, { status: 400 });
  }

  const body = parsedBody.data as { jobId?: unknown; type?: unknown };
  const requestedType = typeof body.type === "string" ? body.type : "";

  if (
    !requestedType ||
    (requestedType.startsWith("job_")
      ? !hasOnlyKeys(body, ["type", "jobId"])
      : !hasOnlyKeys(body, ["type"]))
  ) {
    return Response.json({ error: "Invalid email event." }, { status: 400 });
  }

  if (!isClientEmailEventRequest(body)) {
    return Response.json({ error: "Invalid email event." }, { status: 400 });
  }

  const user = authenticated.user;
  const profile = await getProfile({
    fallbackEmail: user.email ?? "",
    fallbackFullName: getMetadataFullName(user),
    userId: user.id,
  });

  if (!profile.email) {
    return Response.json({ queued: false, skipped: true });
  }

  if (requestedType === "account_created") {
    const result = await EmailService.enqueue({
      data: {
        fullName: profile.fullName,
      },
      dedupeKey: `account_created:${user.id}`,
      recipient: {
        email: profile.email,
        userId: user.id,
      },
      type: "account_created",
    });

    return Response.json(result);
  }

  if (requestedType === "password_reset") {
    const result = await EmailService.enqueue({
      data: {
        fullName: profile.fullName,
      },
      recipient: {
        email: profile.email,
        userId: user.id,
      },
      type: "password_reset",
    });

    return Response.json(result);
  }

  if (
    requestedType !== "job_published" &&
    requestedType !== "job_scheduled" &&
    requestedType !== "job_submitted"
  ) {
    return Response.json({ error: "Invalid email event." }, { status: 400 });
  }

  const job = await getOwnedJob({
    jobId: body.jobId,
    userId: user.id,
  });

  if (!job) {
    return Response.json({ error: "Job not found." }, { status: 404 });
  }

  const publishAt = job.publish_at ? new Date(job.publish_at).getTime() : null;

  if (
    requestedType === "job_published" &&
    (job.status !== "published" ||
      (publishAt !== null &&
        Number.isFinite(publishAt) &&
        publishAt > Date.now()))
  ) {
    return Response.json(
      { error: "Job is not currently public." },
      { status: 409 },
    );
  }

  const eventType =
    requestedType === "job_published"
      ? "job_published"
      : requestedType === "job_scheduled" && job.publish_at
        ? "job_scheduled"
        : "job_submitted";
  const result = await EmailService.enqueue({
    data: {
      companyName: job.company_name ?? "Company",
      jobId: job.id,
      jobTitle: job.title ?? "Untitled job",
      jobUrl: getJobUrl(job.slug),
      publishAt: job.publish_at,
      status: job.status,
    },
    recipient: {
      email: profile.email,
      userId: user.id,
    },
    type: eventType,
  });

  return Response.json(result);
}
