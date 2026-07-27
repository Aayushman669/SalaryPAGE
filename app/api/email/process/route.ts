import type { NextRequest } from "next/server";
import { EmailService } from "@/lib/email/service";
import { hasValidBearerSecret } from "@/lib/api-security";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getProcessorSecret() {
  return process.env.EMAIL_QUEUE_SECRET ?? process.env.CRON_SECRET ?? "";
}

function isAuthorized(request: NextRequest) {
  const processorSecret = getProcessorSecret();
  return hasValidBearerSecret(request, processorSecret);
}

export async function POST(request: NextRequest) {
  const throttled = rateLimitResponse(enforceRateLimit(request, {
    max: 10,
    scope: "api:email:process",
    windowMs: 60_000,
  }));

  if (throttled) return throttled;

  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const parsedLimit = Number(limitParam);
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : 20;
  const result = await EmailService.processQueue({ limit });

  return Response.json(result, {
    status: result.error ? 500 : 200,
  });
}
