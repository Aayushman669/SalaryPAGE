import {
  getAdminApplications,
  getAdminCompanies,
  getAdminJobs,
  getAdminOverview,
  getAdminPayments,
  getAdminModeration,
  getAdminUsers,
} from "@/lib/admin-data";
import { getAuthenticatedApiUser } from "@/lib/api-auth";
import { hasTrustedRole, resolveTrustedActor } from "@/lib/server-authorization";
import {
  revalidatePublicCompanyCaches,
  revalidatePublicJobCaches,
} from "@/lib/public-data-cache";
import { notifyAdministrators } from "@/lib/notification-server";
import { hasOnlyKeys, readJsonBody } from "@/lib/api-security";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sections = new Set(["overview", "users", "companies", "jobs", "applications", "payments", "moderation"]);

const moderationTargetTypes = new Set(["user", "company", "job", "application", "payment"]);
const moderationActionTypes = new Set([
  "warn", "hide", "unhide", "suspend", "restore", "mark_spam", "remove_spam",
  "restrict", "unrestrict", "review", "clear_review",
]);

function getModerationActionId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ section: string }> },
) {
  const throttled = rateLimitResponse(enforceRateLimit(request, {
    max: 120,
    scope: "api:admin:read",
    windowMs: 60_000,
  }));

  if (throttled) return throttled;

  const auth = await getAuthenticatedApiUser(request);

  if (!auth) {
    return Response.json({ error: "Please log in to continue." }, { status: 401 });
  }

  const actor = await resolveTrustedActor(auth.user, auth.supabase);

  if (!hasTrustedRole(actor, ["admin", "super_admin"])) {
    return Response.json({ error: "You are not authorized to access the admin panel." }, { status: 403 });
  }

  const { section } = await context.params;
  if (!sections.has(section)) {
    return Response.json({ error: "Admin section not found." }, { status: 404 });
  }

  try {
    if (section === "overview") {
      return Response.json({
        data: await getAdminOverview(auth.supabase, new URL(request.url).searchParams.get("range")),
      });
    }
    if (section === "users") {
      return Response.json(await getAdminUsers(auth.supabase, new URL(request.url).searchParams));
    }
    if (section === "companies") {
      return Response.json(await getAdminCompanies(auth.supabase, new URL(request.url).searchParams));
    }
    if (section === "jobs") {
      return Response.json(await getAdminJobs(auth.supabase, new URL(request.url).searchParams));
    }
    if (section === "applications") {
      return Response.json(await getAdminApplications(auth.supabase, new URL(request.url).searchParams));
    }
    if (section === "moderation") {
      return Response.json(await getAdminModeration(auth.supabase, new URL(request.url).searchParams));
    }
    return Response.json(await getAdminPayments(auth.supabase, new URL(request.url).searchParams));
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(`[admin] ${section} query failed`, error instanceof Error ? { name: error.name, message: error.message } : { type: typeof error });
    } else {
      console.error(`[admin] ${section} query failed`);
    }
    return Response.json({ error: "We could not load this admin section. Please try again." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ section: string }> },
) {
  const throttled = rateLimitResponse(enforceRateLimit(request, {
    max: 30,
    scope: "api:admin:write",
    windowMs: 60_000,
  }));

  if (throttled) return throttled;

  const auth = await getAuthenticatedApiUser(request);
  if (!auth) return Response.json({ error: "Please log in to continue." }, { status: 401 });
  const actor = await resolveTrustedActor(auth.user, auth.supabase);
  if (!hasTrustedRole(actor, ["admin", "super_admin"])) return Response.json({ error: "You are not authorized to moderate platform records." }, { status: 403 });
  const { section } = await context.params;
  if (section !== "moderation") return Response.json({ error: "This admin action is not available." }, { status: 404 });

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) {
    return Response.json(
      { error: parsedBody.reason === "too_large" ? "Request is too large." : "Invalid JSON request." },
      { status: 400 },
    );
  }

  const body = parsedBody.data as Record<string, unknown> | null;
  if (!hasOnlyKeys(body, ["targetType", "targetId", "actionType", "reason", "internalNote"])) {
    return Response.json({ error: "Invalid moderation action." }, { status: 400 });
  }
  const targetType = typeof body?.targetType === "string" ? body.targetType.trim().toLowerCase() : "";
  const targetId = typeof body?.targetId === "string" ? body.targetId.trim() : "";
  const actionType = typeof body?.actionType === "string" ? body.actionType.trim().toLowerCase() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const internalNote = typeof body?.internalNote === "string" ? body.internalNote.trim().slice(0, 8000) : "";
  if (!moderationTargetTypes.has(targetType) || !moderationActionTypes.has(actionType) || !/^[0-9a-f-]{36}$/i.test(targetId)) {
    return Response.json({ error: "Invalid moderation action." }, { status: 400 });
  }
  if (reason.length < 10 || reason.length > 4000) {
    return Response.json({ error: "Provide a moderation reason of at least 10 characters." }, { status: 400 });
  }
  try {
    const result = await auth.supabase.rpc("apply_moderation_action", {
      p_action_type: actionType,
      p_admin_id: auth.user.id,
      p_internal_note: internalNote,
      p_reason: reason,
      p_target_id: targetId,
      p_target_type: targetType,
    });
    if (result.error) {
      if (process.env.NODE_ENV === "development") console.error("[admin] moderation action failed", { code: result.error.code, message: result.error.message });
      const message = result.error.message?.includes("invalid_moderation_transition")
        ? "That moderation action is not valid for the current state."
        : result.error.message?.includes("moderation_target_not_found")
          ? "The selected record no longer exists."
          : "We could not apply that moderation action.";
      return Response.json({ error: message }, { status: 400 });
    }

    if (targetType === "job") {
      revalidatePublicJobCaches();
    }

    if (targetType === "company") {
      revalidatePublicCompanyCaches();
    }

    const moderationActionId = getModerationActionId(result.data);
    const administratorNotification = await notifyAdministrators({
      eventKey: `moderation:${moderationActionId ?? `${targetType}:${targetId}:${actionType}`}`,
      link: "/admin/moderation",
      message: `A moderation action was applied to a ${targetType}.`,
      metadata: {
        action_type: actionType,
        moderation_action_id: moderationActionId,
        target_type: targetType,
      },
      title: "Moderation action recorded",
      type: "admin_message",
    });

    if (administratorNotification.error && process.env.NODE_ENV === "development") {
      console.error("[admin] moderation notification failed", { error: administratorNotification.error });
    }

    return Response.json({ data: result.data });
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error("[admin] moderation action crashed", error instanceof Error ? { name: error.name, message: error.message } : { type: typeof error });
    return Response.json({ error: "We could not apply that moderation action." }, { status: 500 });
  }
}
