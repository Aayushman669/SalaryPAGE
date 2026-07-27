"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type ModerationTarget = "user" | "company" | "job" | "application" | "payment";
type ModerationAction = "warn" | "hide" | "unhide" | "suspend" | "restore" | "mark_spam" | "remove_spam" | "restrict" | "unrestrict" | "review" | "clear_review";

const labels: Record<ModerationAction, string> = {
  warn: "Issue warning",
  hide: "Hide from public",
  unhide: "Restore visibility",
  suspend: "Suspend account",
  restore: "Restore access",
  mark_spam: "Mark as suspicious",
  remove_spam: "Clear suspicious flag",
  restrict: "Restrict access",
  unrestrict: "Remove restriction",
  review: "Mark for payment review",
  clear_review: "Clear payment review",
};

const confirmationActions = new Set<ModerationAction>(["hide", "suspend", "mark_spam", "restrict"]);

function optionsFor(target: ModerationTarget, status: string): ModerationAction[] {
  if (target === "user") {
    if (status === "suspended") return ["restore"];
    if (status === "restricted") return ["unrestrict"];
    return ["warn", "suspend", "restrict"];
  }
  if (target === "company") {
    if (status === "hidden") return ["restore"];
    if (status === "suspicious") return ["remove_spam"];
    if (status === "restricted") return ["unrestrict"];
    return ["hide", "mark_spam", "restrict"];
  }
  if (target === "job") {
    if (status === "hidden") return ["restore"];
    if (status === "spam") return ["remove_spam"];
    return ["hide", "mark_spam"];
  }
  if (target === "application") return status === "flagged" ? ["remove_spam"] : ["mark_spam"];
  if (status === "restricted") return ["unrestrict"];
  if (status === "review") return ["clear_review", "restrict"];
  return ["review", "restrict"];
}

export default function ModerationControls({
  target,
  targetId,
  targetLabel,
  status,
  onComplete,
}: {
  target: ModerationTarget;
  targetId: string;
  targetLabel: string;
  status: string;
  onComplete: () => void;
}) {
  const actions = optionsFor(target, status);
  const [action, setAction] = useState<ModerationAction | "">(actions[0] ?? "");
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit() {
    if (!action || reason.trim().length < 10 || saving) {
      setError("Provide a reason of at least 10 characters.");
      return;
    }
    if (confirmationActions.has(action) && !confirming) {
      setConfirming(true);
      setError("");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: action, internalNote, reason, targetId, targetType: target }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "We could not apply that action.");
      setSuccess("Moderation action recorded.");
      setConfirming(false);
      setReason("");
      setInternalNote("");
      onComplete();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We could not apply that action.");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="moderation-controls-title" className="mt-6 rounded-2xl border border-yellow-500/40 bg-yellow-500/5 p-4">
      <div>
        <p id="moderation-controls-title" className="text-xs font-bold uppercase tracking-[0.14em] text-yellow-700 dark:text-yellow-300">Moderation</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Current status: <span className="font-semibold text-[var(--foreground)]">{status.replaceAll("_", " ")}</span></p>
      </div>
      {actions.length === 0 ? <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No compatible action is available for this state.</p> : <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Action</span><select value={action} onChange={(event) => { setAction(event.target.value as ModerationAction); setConfirming(false); setError(""); }} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-yellow-300">{actions.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
        <label className="grid gap-1.5"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Reason <span aria-hidden="true">*</span></span><textarea value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} rows={3} maxLength={4000} placeholder="Explain the policy or security concern." className="rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-yellow-300" aria-describedby="moderation-reason-help" /><span id="moderation-reason-help" className="text-xs text-gray-500 dark:text-gray-400">This reason is retained in the audit history.</span></label>
        <label className="grid gap-1.5"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Internal note (optional)</span><textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} rows={2} maxLength={8000} className="rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-yellow-300" /></label>
        {confirming ? <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">Confirm <strong>{labels[action as ModerationAction]}</strong> for <strong>{targetLabel}</strong>. This may change what the user can access.</div> : null}
        {error ? <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p> : null}
        {success ? <p role="status" className="text-sm font-semibold text-green-700 dark:text-green-300">{success}</p> : null}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setConfirming(false); setError(""); }} disabled={saving} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold hover:bg-[var(--muted)] focus:outline-none focus:ring-4 focus:ring-yellow-300">Cancel</button><button type="button" onClick={() => void submit()} disabled={saving || !action} className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] focus:outline-none focus:ring-4 focus:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : confirming ? "Confirm action" : "Apply action"}</button></div>
      </div>}
    </section>
  );
}
