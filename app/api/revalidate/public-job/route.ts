import { NextResponse } from "next/server";
import { getAuthenticatedApiUser } from "@/lib/api-auth";
import { revalidatePublicJobCaches } from "@/lib/public-data-cache";
import { hasTrustedRole, resolveTrustedActor } from "@/lib/server-authorization";
import { hasOnlyKeys, readJsonBody } from "@/lib/api-security";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  const throttled = rateLimitResponse(enforceRateLimit(request, {
    max: 30,
    scope: "api:revalidate:job",
    windowMs: 60_000,
  }));

  if (throttled) {
    return throttled;
  }

  const auth = await getAuthenticatedApiUser(request);

  if (!auth) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const parsedBody = await readJsonBody(request, 16 * 1024);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.reason === "too_large" ? "Request is too large." : "Invalid JSON request." },
      { status: 400 },
    );
  }

  if (!hasOnlyKeys(parsedBody.data, ["jobId"])) {
    return NextResponse.json({ error: "Invalid job." }, { status: 400 });
  }

  const body = parsedBody.data as { jobId?: unknown };

  if (!isUuid(body?.jobId)) {
    return NextResponse.json({ error: "Invalid job." }, { status: 400 });
  }

  const actor = await resolveTrustedActor(auth.user, auth.supabase);

  if (!hasTrustedRole(actor, ["recruiter"])) {
    return NextResponse.json({ error: "Recruiter access required." }, { status: 403 });
  }

  const { data: job, error: jobError } = await auth.supabase
    .from("jobs")
    .select("slug")
    .eq("id", body.jobId)
    .eq("created_by", auth.user.id)
    .maybeSingle();

  if (jobError) {
    return NextResponse.json({ error: "Could not verify job ownership." }, { status: 500 });
  }

  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  revalidatePublicJobCaches(job.slug);

  return NextResponse.json({ ok: true });
}
