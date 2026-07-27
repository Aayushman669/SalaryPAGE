import { NextResponse } from "next/server";
import { getAuthenticatedApiUserClient } from "@/lib/api-auth";
import {
  applyRecruiterJobFilter,
  getRecruiterJobCreatedAfter,
  normalizeRecruiterJobFilter,
  normalizeRecruiterJobCreatedFilter,
  normalizeRecruiterJobSort,
} from "@/lib/recruiter-job-filters";
import { isEmploymentType, isWorkplaceType } from "@/lib/jobs";
import { revalidatePublicJobCaches } from "@/lib/public-data-cache";
import { hasTrustedRole, resolveTrustedActor } from "@/lib/server-authorization";
import {
  mapRecruiterJobListRow,
  recruiterJobListColumns,
  type RecruiterJobListRow,
  type RecruiterJobsResponse,
} from "@/lib/recruiter-jobs";
import { hasOnlyKeys, readJsonBody } from "@/lib/api-security";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pageSize = 12;

const duplicateJobColumns = [
  "id",
  "title",
  "company_id",
  "company_name",
  "location",
  "employment_type",
  "workplace_type",
  "salary_min",
  "salary_max",
  "salary_currency",
  "salary_visible",
  "experience_level",
  "category",
  "description",
  "requirements",
  "benefits",
  "application_url",
  "application_email",
  "featured",
  "status",
  "publish_at",
  "expires_at",
].join(", ");

const actionValues = ["duplicate", "close", "reopen", "delete"] as const;
type RecruiterJobAction = (typeof actionValues)[number];

type ActionRequest = {
  action: RecruiterJobAction;
  jobId: string;
};

type DuplicateJobRow = {
  application_email: string | null;
  application_url: string | null;
  benefits: string;
  category: string;
  company_id: string | null;
  company_name: string;
  description: string;
  employment_type: string;
  experience_level: string | null;
  expires_at: string | null;
  featured: boolean;
  location: string;
  publish_at: string | null;
  requirements: string;
  salary_currency: string;
  salary_max: number | string | null;
  salary_min: number | string | null;
  salary_visible: boolean;
  title: string;
  workplace_type: string;
};

function safeSearch(value: string | null) {
  return value?.replace(/[%(),]/g, " ").trim().replace(/\s+/g, " ") || "";
}

function safePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? Math.min(page, 10000) : 1;
}

function isRecruiterJobAction(value: unknown): value is RecruiterJobAction {
  return typeof value === "string" && actionValues.includes(value as RecruiterJobAction);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseActionRequest(value: unknown): ActionRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as { action?: unknown; jobId?: unknown };

  if (!isRecruiterJobAction(body.action) || !isUuid(body.jobId)) return null;
  return { action: body.action, jobId: body.jobId };
}

function logRecruiterJobsError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") return;

  if (error && typeof error === "object") {
    const record = error as { code?: unknown; message?: unknown };
    console.error(context, { code: record.code, message: record.message });
    return;
  }

  console.error(context, { type: typeof error });
}

export async function GET(request: Request) {
  const auth = await getAuthenticatedApiUserClient(request);

  if (!auth) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const throttled = rateLimitResponse(enforceRateLimit(request, {
    identity: auth.user.id,
    max: 60,
    scope: "api:recruiter:jobs:read",
    windowMs: 60_000,
  }));

  if (throttled) {
    return throttled;
  }

  const actor = await resolveTrustedActor(auth.user, auth.supabase);

  if (!hasTrustedRole(actor, ["recruiter"])) {
    return NextResponse.json(
      { error: "Recruiter job management is available only to recruiters." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const filter = normalizeRecruiterJobFilter(url.searchParams.get("status"));
  const created = normalizeRecruiterJobCreatedFilter(url.searchParams.get("created"));
  const sort = normalizeRecruiterJobSort(url.searchParams.get("sort"));
  const employment = url.searchParams.get("employment");
  const workplace = url.searchParams.get("workplace");
  const query = safeSearch(url.searchParams.get("q"));
  const page = safePage(url.searchParams.get("page"));
  const nowIso = new Date().toISOString();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let jobsQuery = auth.supabase
    .from("jobs")
    .select(recruiterJobListColumns, { count: "exact" })
    .eq("created_by", auth.user.id);

  jobsQuery = applyRecruiterJobFilter(jobsQuery, filter, nowIso);

  if (employment && isEmploymentType(employment)) {
    jobsQuery = jobsQuery.eq("employment_type", employment);
  }

  if (workplace && isWorkplaceType(workplace)) {
    jobsQuery = jobsQuery.eq("workplace_type", workplace);
  }

  const createdAfter = getRecruiterJobCreatedAfter(created);
  if (createdAfter) {
    jobsQuery = jobsQuery.gte("created_at", createdAfter);
  }

  if (query) {
    const pattern = `%${query}%`;
    jobsQuery = jobsQuery.or(
      [
        `title.ilike.${pattern}`,
        `company_name.ilike.${pattern}`,
        `location.ilike.${pattern}`,
        `employment_type.ilike.${pattern}`,
      ].join(","),
    );
  }

  if (sort === "oldest") {
    jobsQuery = jobsQuery.order("created_at", { ascending: true, nullsFirst: false });
  } else if (sort === "applications") {
    jobsQuery = jobsQuery.order("applications_count", { ascending: false, nullsFirst: false });
  } else if (sort === "updated") {
    jobsQuery = jobsQuery.order("updated_at", { ascending: false, nullsFirst: false });
  } else if (sort === "alphabetical") {
    jobsQuery = jobsQuery.order("title", { ascending: true, nullsFirst: false });
  } else {
    jobsQuery = jobsQuery.order("created_at", { ascending: false, nullsFirst: false });
  }

  jobsQuery = jobsQuery.order("id", { ascending: false });

  const { count, data, error } = await jobsQuery.range(from, to);

  if (error) {
    logRecruiterJobsError("[recruiter-jobs] list lookup failed", error);
    return NextResponse.json(
      { error: "We could not load your jobs. Please try again." },
      { status: 500 },
    );
  }

  const total = count ?? 0;
  const response: RecruiterJobsResponse = {
    data: ((data ?? []) as RecruiterJobListRow[]).map(mapRecruiterJobListRow),
    filter,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedApiUserClient(request);

  if (!auth) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const throttled = rateLimitResponse(enforceRateLimit(request, {
    identity: auth.user.id,
    max: 30,
    scope: "api:recruiter:jobs:write",
    windowMs: 60_000,
  }));

  if (throttled) {
    return throttled;
  }

  const actor = await resolveTrustedActor(auth.user, auth.supabase);

  if (!hasTrustedRole(actor, ["recruiter"])) {
    return NextResponse.json(
      { error: "Recruiter job management is available only to recruiters." },
      { status: 403 },
    );
  }

  if (actor?.profile?.moderation_status === "suspended" || actor?.profile?.moderation_status === "restricted") {
    return NextResponse.json(
      {
        error:
          actor.profile.moderation_status === "suspended"
            ? "Your account is temporarily suspended from managing jobs."
            : "Your account is temporarily restricted from managing jobs.",
      },
      { status: 403 },
    );
  }

  const parsedBody = await readJsonBody(request, 16 * 1024);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.reason === "too_large" ? "Request is too large." : "Invalid job action request." },
      { status: 400 },
    );
  }

  if (!hasOnlyKeys(parsedBody.data, ["action", "jobId"])) {
    return NextResponse.json({ error: "Choose a valid job action." }, { status: 400 });
  }

  const actionRequest = parseActionRequest(parsedBody.data);
  if (!actionRequest) {
    return NextResponse.json({ error: "Choose a valid job action." }, { status: 400 });
  }

  const { action, jobId } = actionRequest;

  if (action === "duplicate") {
    const { data: source, error: sourceError } = await auth.supabase
      .from("jobs")
      .select(duplicateJobColumns)
      .eq("id", jobId)
      .eq("created_by", auth.user.id)
      .maybeSingle();

    if (sourceError) {
      logRecruiterJobsError("[recruiter-jobs] duplicate source lookup failed", sourceError);
      return NextResponse.json({ error: "We could not duplicate this job." }, { status: 500 });
    }

    if (!source) {
      return NextResponse.json({ error: "That job could not be found." }, { status: 404 });
    }

    const sourceRow = source as unknown as DuplicateJobRow;
    const { data: duplicate, error: duplicateError } = await auth.supabase
      .from("jobs")
      .insert({
        application_email: sourceRow.application_email,
        application_url: sourceRow.application_url,
        benefits: sourceRow.benefits,
        category: sourceRow.category,
        company_id: sourceRow.company_id,
        company_name: sourceRow.company_name,
        created_by: auth.user.id,
        description: sourceRow.description,
        employment_type: sourceRow.employment_type,
        experience_level: sourceRow.experience_level,
        expires_at: null,
        featured: false,
        location: sourceRow.location,
        publish_at: null,
        requirements: sourceRow.requirements,
        salary_currency: sourceRow.salary_currency,
        salary_max: sourceRow.salary_max,
        salary_min: sourceRow.salary_min,
        salary_visible: sourceRow.salary_visible,
        status: "draft",
        title: sourceRow.title,
        workplace_type: sourceRow.workplace_type,
      })
      .select("id, status, updated_at")
      .single();

    if (duplicateError) {
      logRecruiterJobsError("[recruiter-jobs] duplicate insert failed", duplicateError);
      return NextResponse.json({ error: "We could not duplicate this job." }, { status: 500 });
    }

    return NextResponse.json({ action, job: duplicate, message: "Job duplicated as a draft." });
  }

  const { data: source, error: sourceError } = await auth.supabase
    .from("jobs")
    .select("id, slug, status, expires_at")
    .eq("id", jobId)
    .eq("created_by", auth.user.id)
    .maybeSingle();

  if (sourceError) {
    logRecruiterJobsError("[recruiter-jobs] action source lookup failed", sourceError);
    return NextResponse.json({ error: "We could not update this job." }, { status: 500 });
  }

  if (!source) {
    return NextResponse.json({ error: "That job could not be found." }, { status: 404 });
  }

  if (action === "close") {
    if (source.status === "closed") {
      return NextResponse.json({ action, job: source, message: "Job is already closed." });
    }

    const { data: job, error } = await auth.supabase
      .from("jobs")
      .update({ featured: false, status: "closed" })
      .eq("id", jobId)
      .eq("created_by", auth.user.id)
      .in("status", ["published", "pending"])
      .select("id, status, updated_at")
      .maybeSingle();

    if (error) {
      logRecruiterJobsError("[recruiter-jobs] close failed", error);
      return NextResponse.json({ error: "We could not close this job." }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: "This job is not eligible to be closed." }, { status: 409 });
    }

    revalidatePublicJobCaches(source.slug);

    return NextResponse.json({ action, job, message: "Job closed successfully." });
  }

  if (action === "reopen") {
    if (source.status === "published" && (!source.expires_at || new Date(source.expires_at).getTime() > Date.now())) {
      return NextResponse.json({ action, job: source, message: "Job is already active." });
    }

    const { data: job, error } = await auth.supabase
      .from("jobs")
      .update({ expires_at: null, featured: false, publish_at: null, status: "published" })
      .eq("id", jobId)
      .eq("created_by", auth.user.id)
      .in("status", ["closed", "archived", "published"])
      .select("id, status, updated_at")
      .maybeSingle();

    if (error) {
      logRecruiterJobsError("[recruiter-jobs] reopen failed", error);
      return NextResponse.json({ error: "We could not reopen this job." }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: "This job is not eligible to be reopened." }, { status: 409 });
    }

    revalidatePublicJobCaches(source.slug);

    return NextResponse.json({ action, job, message: "Job reopened successfully." });
  }

  if (source.status === "draft") {
    const { data: job, error } = await auth.supabase
      .from("jobs")
      .delete()
      .eq("id", jobId)
      .eq("created_by", auth.user.id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();

    if (error) {
      logRecruiterJobsError("[recruiter-jobs] delete failed", error);
      return NextResponse.json({ error: "We could not delete this draft." }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: "This draft could not be found." }, { status: 404 });
    }

    return NextResponse.json({ action, job, message: "Draft deleted permanently." });
  }

  const { data: archivedJob, error: archiveError } = await auth.supabase
    .from("jobs")
    .update({ featured: false, status: "archived" })
    .eq("id", jobId)
    .eq("created_by", auth.user.id)
    .neq("status", "draft")
    .select("id, status, updated_at")
    .maybeSingle();

  if (archiveError) {
    logRecruiterJobsError("[recruiter-jobs] archive failed", archiveError);
    return NextResponse.json({ error: "We could not remove this job." }, { status: 500 });
  }

  if (!archivedJob) {
    return NextResponse.json({ error: "This job is already archived." }, { status: 409 });
  }

  revalidatePublicJobCaches(source.slug);

  return NextResponse.json({
    action,
    archived: true,
    job: archivedJob,
    message: "Job archived. Existing applications were preserved.",
  });
}
