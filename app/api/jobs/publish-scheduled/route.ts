import type { NextRequest } from "next/server";
import { EmailService } from "@/lib/email/service";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase-admin";
import { revalidatePublicJobCaches } from "@/lib/public-data-cache";
import { hasValidBearerSecret } from "@/lib/api-security";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DueJobRow = {
  company_name: string | null;
  created_by: string | null;
  id: string;
  publish_at: string | null;
  slug: string | null;
  title: string | null;
};

type ProfileRow = {
  email: string | null;
  full_name: string | null;
  id: string;
};

function getSchedulerSecret() {
  return process.env.JOB_SCHEDULER_SECRET ?? process.env.CRON_SECRET ?? "";
}

function isAuthorized(request: NextRequest) {
  const schedulerSecret = getSchedulerSecret();
  return hasValidBearerSecret(request, schedulerSecret);
}

function getJobUrl(slug: string | null | undefined) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  return siteUrl && slug ? `${siteUrl}/jobs/${slug}` : "";
}

async function enqueuePublishedEmails({
  jobs,
  profiles,
}: {
  jobs: DueJobRow[];
  profiles: ProfileRow[];
}) {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  await Promise.all(
    jobs.map(async (job) => {
      if (!job.created_by) {
        return;
      }

      const profile = profilesById.get(job.created_by);

      if (!profile?.email) {
        return;
      }

      await EmailService.enqueue({
        data: {
          companyName: job.company_name ?? "Company",
          jobId: job.id,
          jobTitle: job.title ?? "Untitled job",
          jobUrl: getJobUrl(job.slug),
          publishAt: job.publish_at,
        },
        dedupeKey: `job_published:${job.id}:${job.publish_at ?? "immediate"}`,
        recipient: {
          email: profile.email,
          userId: profile.id,
        },
        type: "job_published",
      });
    }),
  );
}

export async function POST(request: NextRequest) {
  const throttled = rateLimitResponse(enforceRateLimit(request, {
    max: 10,
    scope: "api:jobs:publish-scheduled",
    windowMs: 60_000,
  }));

  if (throttled) return throttled;

  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured) {
    return Response.json(
      { error: "Supabase scheduler is not configured." },
      { status: 500 },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return Response.json(
      { error: "Supabase scheduler is not configured." },
      { status: 500 },
    );
  }

  const nowIso = new Date().toISOString();
  const { data: dueJobsData, error: dueJobsError } = await supabase
    .from("jobs")
    .select("id, title, company_name, created_by, publish_at, slug")
    .eq("status", "published")
    .not("publish_at", "is", null)
    .lte("publish_at", nowIso)
    .order("publish_at", { ascending: true })
    .limit(100);

  if (dueJobsError) {
    if (process.env.NODE_ENV === "development") {
      console.error("[jobs-scheduler] due job lookup failed", {
        code: dueJobsError.code,
        details: dueJobsError.details,
        hint: dueJobsError.hint,
        message: dueJobsError.message,
      });
    }

    return Response.json(
      { error: "Scheduled publishing failed." },
      { status: 500 },
    );
  }

  const dueJobs = (dueJobsData ?? []) as DueJobRow[];
  const profileIds = Array.from(
    new Set(
      dueJobs
        .map((job) => job.created_by)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  );
  const { data: profileData } =
    profileIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds)
      : { data: [] };
  const { data, error } = await supabase.rpc("activate_due_scheduled_jobs");

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[jobs-scheduler] scheduled publish failed", {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return Response.json(
      { error: "Scheduled publishing failed." },
      { status: 500 },
    );
  }

  await enqueuePublishedEmails({
    jobs: dueJobs,
    profiles: (profileData ?? []) as ProfileRow[],
  });

  if (dueJobs.length > 0) {
    revalidatePublicJobCaches();
  }

  return Response.json({
    processed: typeof data === "number" ? data : 0,
    success: true,
  });
}
