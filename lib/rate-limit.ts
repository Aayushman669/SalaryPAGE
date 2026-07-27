import "server-only";

import { recordSecurityEvent } from "@/lib/security-events";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitPolicy = {
  max: number;
  scope: string;
  windowMs: number;
  identity?: string | null;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, RateLimitBucket>();
const rejectionLogTimes = new Map<string, number>();
const maxBuckets = 10_000;

function normalizeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 160) || "unknown";
}

function getRequestSource(request: Request) {
  const trustedForwardedFor = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",", 1)[0]
    ?? "unknown";

  return normalizeKey(trustedForwardedFor.trim());
}

function pruneBuckets(now: number) {
  if (buckets.size < maxBuckets) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }

    if (buckets.size < maxBuckets) {
      break;
    }
  }
}

function logRejection(scope: string, now: number) {
  const lastLoggedAt = rejectionLogTimes.get(scope) ?? 0;

  if (now - lastLoggedAt < 60_000) {
    return;
  }

  rejectionLogTimes.set(scope, now);
  console.warn("[rate-limit] request throttled", { scope });
  void recordSecurityEvent({
    eventType: "rate_limit_exceeded",
    metadata: { scope },
    severity: "warning",
  });
}

export function enforceRateLimit(
  request: Request,
  policy: RateLimitPolicy,
): RateLimitResult {
  const now = Date.now();
  const max = Math.max(1, Math.floor(policy.max));
  const windowMs = Math.max(1_000, Math.floor(policy.windowMs));
  const keys = [
    `${normalizeKey(policy.scope)}:ip:${getRequestSource(request)}`,
  ];

  if (policy.identity) {
    keys.push(`${normalizeKey(policy.scope)}:actor:${normalizeKey(policy.identity)}`);
  }

  pruneBuckets(now);

  const states = keys.map((key) => {
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      return { count: 0, key, resetAt: now + windowMs };
    }

    return { count: current.count, key, resetAt: current.resetAt };
  });
  const blocked = states.find((state) => state.count >= max);

  if (blocked) {
    logRejection(policy.scope, now);

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((blocked.resetAt - now) / 1000)),
    };
  }

  for (const state of states) {
    buckets.set(state.key, {
      count: state.count + 1,
      resetAt: state.resetAt,
    });
  }

  return {
    allowed: true,
    remaining: Math.max(0, max - states[0].count - 1),
    retryAfterSeconds: 0,
  };
}

export function rateLimitResponse(result: RateLimitResult) {
  if (result.allowed) {
    return null;
  }

  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(result.retryAfterSeconds),
      },
      status: 429,
    },
  );
}
