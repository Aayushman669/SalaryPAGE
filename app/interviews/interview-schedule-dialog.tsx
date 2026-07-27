"use client";

import { useMemo, useState } from "react";
import {
  getDefaultInterviewTimezone,
  isoToLocalDateTime,
  type Interview,
  type InterviewApplicationOption,
  type InterviewFormValues,
  interviewTypes,
  interviewTypeLabels,
  validateInterviewForm,
} from "@/lib/interviews";
import { supabase } from "@/lib/supabase";
import { showSuccessToast } from "@/lib/toast";
import ApplicationConfirmationDialog from "@/app/applications/application-confirmation-dialog";

function createInitialValues(interview: Interview | null): InterviewFormValues {
  const timezone = interview?.timezone ?? getDefaultInterviewTimezone();
  const localStart = interview
    ? isoToLocalDateTime(interview.scheduledStart, timezone)
    : { date: "", time: "" };
  const localEnd = interview
    ? isoToLocalDateTime(interview.scheduledEnd, timezone)
    : { date: "", time: "" };

  return {
    candidateInstructions: interview?.candidateInstructions ?? "",
    date: localStart.date,
    endTime: localEnd.time,
    interviewType: interview?.interviewType ?? "video",
    location: interview?.location ?? "",
    meetingLink: interview?.meetingLink ?? "",
    phoneNumber: interview?.phoneNumber ?? "",
    recruiterNotes: interview?.recruiterNotes ?? "",
    startTime: localStart.time,
    timezone,
  };
}

function getFriendlyInterviewError(error: unknown) {
  const text =
    error && typeof error === "object" && "message" in error
      ? String(error.message).toLowerCase()
      : String(error).toLowerCase();

  if (text.includes("conflict")) return "This time overlaps another scheduled interview.";
  if (text.includes("future")) return "Choose a future interview time.";
  if (text.includes("timezone")) return "Choose a valid timezone such as Asia/Calcutta or UTC.";
  if (text.includes("meeting")) return "Use a valid HTTPS meeting link.";
  if (text.includes("phone")) return "Enter a valid phone number.";
  if (text.includes("location")) return "Enter the interview location.";
  if (text.includes("permission") || text.includes("forbidden")) return "You are not allowed to manage this interview.";
  return "We could not save the interview. Please try again.";
}

export default function InterviewScheduleDialog({
  applications,
  initialApplicationId = "",
  interview = null,
  onClose,
  onSaved,
}: {
  applications: InterviewApplicationOption[];
  initialApplicationId?: string;
  interview?: Interview | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [applicationId, setApplicationId] = useState(
    interview?.applicationId ?? initialApplicationId,
  );
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<InterviewFormValues>(() =>
    createInitialValues(interview),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [conflictDescription, setConflictDescription] = useState<string | null>(null);

  const selectedApplication = useMemo(
    () => applications.find((item) => item.applicationId === applicationId) ?? null,
    [applications, applicationId],
  );
  const isReschedule = Boolean(interview);

  function updateForm<K extends keyof InterviewFormValues>(
    key: K,
    value: InterviewFormValues[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function submit(ignoreConflict = false) {
    if (!supabase || isSaving) return;

    setError(null);
    if (!applicationId && !interview) {
      setError("Select an applicant.");
      return;
    }

    const validation = validateInterviewForm(form);
    if (Object.keys(validation.errors).length > 0) {
      setError(Object.values(validation.errors)[0] ?? "Check the interview details.");
      return;
    }
    if (!validation.startIso || !validation.endIso) {
      setError("Check the interview date and time.");
      return;
    }

    if (!ignoreConflict) {
      const { data: conflictData, error: conflictError } = await supabase.rpc(
        "check_recruiter_interview_conflict",
        {
          p_interview_id: interview?.id ?? null,
          p_scheduled_end: validation.endIso,
          p_scheduled_start: validation.startIso,
        },
      );

      if (conflictError) {
        setError(getFriendlyInterviewError(conflictError));
        return;
      }

      const conflict = (conflictData ?? [])[0] as
        | {
            conflicting_candidate_name?: string | null;
            conflicting_scheduled_start?: string | null;
            has_conflict?: boolean | null;
          }
        | undefined;
      if (conflict?.has_conflict) {
        const when = conflict.conflicting_scheduled_start
          ? new Date(conflict.conflicting_scheduled_start).toLocaleString()
          : "the selected time";
        setConflictDescription(
          `This overlaps an interview for ${conflict.conflicting_candidate_name ?? "another applicant"} at ${when}. You can continue if this is intentional.`,
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      const interviewId = interview?.id;
      if (isReschedule && !interviewId) {
        throw new Error("Interview not found.");
      }

      const rpcName = isReschedule
        ? "reschedule_recruiter_interview"
        : "schedule_recruiter_interview";
      const payload = {
        p_candidate_instructions: form.candidateInstructions.trim(),
        p_ignore_conflict: ignoreConflict,
        p_interview_type: form.interviewType,
        p_location: form.interviewType === "on_site" ? form.location.trim() : null,
        p_meeting_link: form.interviewType === "video" ? form.meetingLink.trim() : null,
        p_phone_number: form.interviewType === "phone" ? form.phoneNumber.trim() : null,
        p_recruiter_notes: form.recruiterNotes.trim(),
        p_scheduled_end: validation.endIso,
        p_scheduled_start: validation.startIso,
        p_timezone: form.timezone.trim(),
        ...(isReschedule
          ? { p_interview_id: interviewId }
          : { p_application_id: applicationId }),
      };
      const { data, error: saveError } = await supabase.rpc(rpcName, payload);

      if (saveError || !Array.isArray(data) || data.length === 0) {
        throw saveError ?? new Error("Interview save failed.");
      }

      showSuccessToast(isReschedule ? "Interview rescheduled." : "Interview scheduled.");
      onSaved();
    } catch (saveFailure) {
      if (process.env.NODE_ENV === "development") {
        console.error("[interviews] save failed", saveFailure);
      }
      setError(getFriendlyInterviewError(saveFailure));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div
        aria-modal="true"
        className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-gray-900/35 px-4 py-8 backdrop-blur-sm"
        role="dialog"
      >
        <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_28px_90px_rgba(17,24,39,0.22)] sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                {isReschedule ? "Interview management" : "Recruiter interviews"}
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                {isReschedule ? "Reschedule interview" : "Schedule interview"}
              </h2>
              {selectedApplication || interview ? (
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {selectedApplication?.candidateName ?? interview?.candidateName} · {selectedApplication?.jobTitle ?? interview?.jobTitle}
                </p>
              ) : null}
            </div>
            <button
              aria-label="Close interview form"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-lg font-semibold text-gray-700 focus:outline-none focus:ring-4 focus:ring-yellow-200"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>

          {error ? (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {!isReschedule ? (
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Applicant</span>
                <select
                  className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                  disabled={isSaving}
                  onChange={(event) => setApplicationId(event.target.value)}
                  value={applicationId}
                >
                  <option value="">Select an applicant...</option>
                  {applications.map((application) => (
                    <option key={application.applicationId} value={application.applicationId}>
                      {application.candidateName} · {application.jobTitle}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Interview type</span>
              <select
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                disabled={isSaving}
                onChange={(event) => {
                  if (interviewTypes.includes(event.target.value as typeof interviewTypes[number])) {
                    updateForm("interviewType", event.target.value as InterviewFormValues["interviewType"]);
                  }
                }}
                value={form.interviewType}
              >
                {interviewTypes.map((type) => (
                  <option key={type} value={type}>{interviewTypeLabels[type]}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Timezone</span>
              <input className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" disabled={isSaving} onChange={(event) => updateForm("timezone", event.target.value)} value={form.timezone} />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Date</span>
              <input className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" disabled={isSaving} onChange={(event) => updateForm("date", event.target.value)} type="date" value={form.date} />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Start time</span>
              <input className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" disabled={isSaving} onChange={(event) => updateForm("startTime", event.target.value)} type="time" value={form.startTime} />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">End time</span>
              <input className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" disabled={isSaving} onChange={(event) => updateForm("endTime", event.target.value)} type="time" value={form.endTime} />
            </label>

            {form.interviewType === "video" ? (
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">HTTPS meeting link</span>
                <input className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" disabled={isSaving} onChange={(event) => updateForm("meetingLink", event.target.value)} placeholder="https://meet.example.com/..." type="url" value={form.meetingLink} />
              </label>
            ) : null}
            {form.interviewType === "phone" ? (
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Phone number</span>
                <input className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" disabled={isSaving} onChange={(event) => updateForm("phoneNumber", event.target.value)} placeholder="Contact number or calling instructions" type="tel" value={form.phoneNumber} />
              </label>
            ) : null}
            {form.interviewType === "on_site" ? (
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Location</span>
                <input className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" disabled={isSaving} onChange={(event) => updateForm("location", event.target.value)} placeholder="Office address or meeting room" value={form.location} />
              </label>
            ) : null}
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Candidate instructions</span>
              <textarea className="min-h-24 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium leading-6 text-gray-900 outline-none placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" disabled={isSaving} maxLength={4000} onChange={(event) => updateForm("candidateInstructions", event.target.value)} placeholder="What should the candidate prepare or bring?" value={form.candidateInstructions} />
            </label>
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Private recruiter notes</span>
              <textarea className="min-h-24 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium leading-6 text-gray-900 outline-none placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" disabled={isSaving} maxLength={12000} onChange={(event) => updateForm("recruiterNotes", event.target.value)} placeholder="Private notes for your hiring team" value={form.recruiterNotes} />
            </label>
          </div>

          <p className="mt-4 text-xs leading-5 text-gray-500">
            Times are stored in UTC and displayed using the selected timezone. Interview status starts as Scheduled.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:opacity-60" disabled={isSaving} onClick={onClose} type="button">Cancel</button>
            <button className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} onClick={() => void submit()} type="button">
              {isSaving ? "Saving..." : isReschedule ? "Save new time" : "Schedule interview"}
            </button>
          </div>
        </div>
      </div>

      {conflictDescription ? (
        <ApplicationConfirmationDialog
          confirmLabel="Continue anyway"
          description={conflictDescription}
          isBusy={isSaving}
          onCancel={() => setConflictDescription(null)}
          onConfirm={() => {
            setConflictDescription(null);
            void submit(true);
          }}
          title="Scheduling conflict"
        />
      ) : null}
    </>
  );
}
