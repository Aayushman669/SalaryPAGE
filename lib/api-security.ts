import "server-only";

import { timingSafeEqual } from "node:crypto";

export type JsonBodyResult =
  | { data: unknown; ok: true }
  | { ok: false; reason: "content_type" | "invalid_json" | "too_large" };

export type RequestTextResult =
  | { text: string; ok: true }
  | { ok: false; reason: "invalid_body" | "too_large" };

async function readRequestText(
  request: Request,
  maxBytes: number,
): Promise<RequestTextResult> {
  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  if (!request.body) {
    try {
      const text = await request.text();
      return new TextEncoder().encode(text).byteLength <= maxBytes
        ? { ok: true, text }
        : { ok: false, reason: "too_large" };
    } catch {
      return { ok: false, reason: "invalid_body" };
    }
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }

      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid_body" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(bytes) };
}

export async function readJsonBody(
  request: Request,
  maxBytes = 64 * 1024,
): Promise<JsonBodyResult> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();

  if (contentType !== "application/json") {
    return { ok: false, reason: "content_type" };
  }

  const rawBody = await readRequestText(request, maxBytes);

  if (!rawBody.ok) {
    return {
      ok: false,
      reason: rawBody.reason === "too_large" ? "too_large" : "invalid_json",
    };
  }

  try {
    return { data: JSON.parse(rawBody.text) as unknown, ok: true };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

export async function readRawRequestBody(
  request: Request,
  maxBytes: number,
): Promise<RequestTextResult> {
  return readRequestText(request, maxBytes);
}

export function hasOnlyKeys(
  value: unknown,
  allowedKeys: readonly string[],
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

export function hasValidBearerSecret(
  request: Request,
  expectedSecret: string,
) {
  if (!expectedSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.trim().split(/\s+/, 2);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return false;
  }

  const expected = Buffer.from(expectedSecret, "utf8");
  const received = Buffer.from(token, "utf8");

  return expected.length === received.length && timingSafeEqual(expected, received);
}
