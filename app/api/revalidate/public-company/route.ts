import { NextResponse } from "next/server";
import { getAuthenticatedApiUser } from "@/lib/api-auth";
import { revalidatePublicCompanyCaches } from "@/lib/public-data-cache";
import { hasTrustedRole, resolveTrustedActor } from "@/lib/server-authorization";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const throttled = rateLimitResponse(enforceRateLimit(request, {
    max: 30,
    scope: "api:revalidate:company",
    windowMs: 60_000,
  }));

  if (throttled) {
    return throttled;
  }

  const auth = await getAuthenticatedApiUser(request);

  if (!auth) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const actor = await resolveTrustedActor(auth.user, auth.supabase);

  if (!hasTrustedRole(actor, ["recruiter"])) {
    return NextResponse.json({ error: "Recruiter access required." }, { status: 403 });
  }

  const { data: company, error: companyError } = await auth.supabase
    .from("companies")
    .select("slug")
    .eq("recruiter_id", auth.user.id)
    .maybeSingle();

  if (companyError) {
    return NextResponse.json({ error: "Could not verify company ownership." }, { status: 500 });
  }

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  revalidatePublicCompanyCaches(company.slug);

  return NextResponse.json({ ok: true });
}
