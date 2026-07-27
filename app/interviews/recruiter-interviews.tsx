"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ProfileRow } from "@/lib/auth-profiles";
import {
  formatInterviewDateTime,
  getInterviewStatusLabel,
  getInterviewTypeLabel,
  interviewStatuses,
  interviewTypes,
  interviewViews,
  mapInterviewEventRow,
  mapInterviewRow,
  type Interview,
  type InterviewApplicationOption,
  type InterviewEvent,
  type InterviewEventRow,
  type InterviewRow,
  type InterviewStatus,
  type InterviewType,
  type InterviewView,
} from "@/lib/interviews";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import CandidateAvatar from "@/app/applications/candidate-avatar";
import InterviewReasonDialog from "./interview-reason-dialog";
import InterviewScheduleDialog from "./interview-schedule-dialog";

type JobOption = { id: string; title: string };

const pageSize = 20;

function isInterviewView(value: string | null): value is InterviewView {
  return interviewViews.includes(value as InterviewView);
}

function isInterviewSort(value: string | null): value is "soonest" | "latest" | "updated" {
  return value === "soonest" || value === "latest" || value === "updated";
}

function isInterviewStatusValue(value: string): value is InterviewStatus {
  return interviewStatuses.includes(value as InterviewStatus);
}

function isInterviewTypeValue(value: string): value is InterviewType {
  return interviewTypes.includes(value as InterviewType);
}

function formatDate(value: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatEventLabel(eventType: string) {
  return eventType.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase());
}

function getFriendlyError(error: unknown) {
  const text = error && typeof error === "object" && "message" in error
    ? String(error.message).toLowerCase()
    : String(error).toLowerCase();
  if (text.includes("permission") || text.includes("forbidden")) return "You are not allowed to manage this interview.";
  if (text.includes("not found")) return "This interview is no longer available.";
  if (text.includes("network") || text.includes("fetch")) return "We could not connect. Please try again.";
  return "We could not load the interview data. Please try again.";
}

function statusClass(status: InterviewStatus) {
  if (status === "scheduled") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "cancelled") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function InterviewStatusBadge({ status }: { status: InterviewStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusClass(status)}`}>
      {getInterviewStatusLabel(status)}
    </span>
  );
}

function getParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? "";
}

export default function RecruiterInterviews({ profile }: { profile: ProfileRow }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = getParam(searchParams, "view");
  const statusParam = getParam(searchParams, "status");
  const typeParam = getParam(searchParams, "type");
  const jobParam = getParam(searchParams, "job");
  const searchParam = getParam(searchParams, "q");
  const dateFromParam = getParam(searchParams, "from");
  const dateToParam = getParam(searchParams, "to");
  const sortParam = getParam(searchParams, "sort");
  const pageParam = Math.max(1, Number(getParam(searchParams, "page")) || 1);
  const view = isInterviewView(viewParam) ? viewParam : "upcoming";
  const sort = isInterviewSort(sortParam) ? sortParam : "soonest";
  const status = statusParam && isInterviewStatusValue(statusParam) ? statusParam : "";
  const interviewType = typeParam && isInterviewTypeValue(typeParam) ? typeParam : "";

  const [applicationOptions, setApplicationOptions] = useState<InterviewApplicationOption[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [dateFromDraft, setDateFromDraft] = useState(dateFromParam);
  const [dateToDraft, setDateToDraft] = useState(dateToParam);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<InterviewEvent[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Interview | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"create" | "reschedule" | null>(null);
  const [reasonAction, setReasonAction] = useState<"cancel" | "completed" | "no_show" | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const selectedInterview = selectedDetail ?? interviews.find((item) => item.id === selectedId) ?? null;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const updateUrl = useCallback((changes: Record<string, string | number>) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value === "" || value === 0) nextParams.delete(key);
      else nextParams.set(key, String(value));
    });
    if (changes.page === undefined) nextParams.delete("page");
    router.push(`/interviews${nextParams.toString() ? `?${nextParams.toString()}` : ""}`);
  }, [router, searchParams]);

  useEffect(() => {
    const syncId = window.setTimeout(() => {
      setDateFromDraft(dateFromParam);
      setDateToDraft(dateToParam);
    }, 0);

    return () => window.clearTimeout(syncId);
  }, [dateFromParam, dateToParam]);

  const loadInterviews = useCallback(async () => {
    if (!supabase) {
      setError("Supabase is not configured. Please check your environment variables.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.rpc("get_recruiter_interviews", {
        p_date_from: dateFromParam || null,
        p_date_to: dateToParam || null,
        p_interview_type: interviewType || null,
        p_job_id: jobParam || null,
        p_limit: pageSize,
        p_offset: (pageParam - 1) * pageSize,
        p_search: searchParam,
        p_sort: sort,
        p_status: status || null,
        p_view: view,
      });
      if (fetchError) throw fetchError;
      const nextInterviews = ((data ?? []) as InterviewRow[]).flatMap((row) => {
        const mapped = mapInterviewRow(row);
        return mapped ? [mapped] : [];
      });
      setInterviews(nextInterviews);
      setTotalCount(Number((data as Array<{ total_count?: number | null }> | null)?.[0]?.total_count ?? 0));
      if (!nextInterviews.some((item) => item.id === selectedId)) {
        setSelectedId(null);
        setSelectedDetail(null);
        setEvents([]);
      }
    } catch (loadError) {
      if (process.env.NODE_ENV === "development") console.error("[interviews] list load failed", loadError);
      setInterviews([]);
      setTotalCount(0);
      setError(getFriendlyError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [dateFromParam, dateToParam, interviewType, jobParam, pageParam, searchParam, selectedId, sort, status, view]);

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      void loadInterviews();
    }, 0);

    return () => window.clearTimeout(loadId);
  }, [loadInterviews]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    async function loadOptions() {
      try {
        const [jobResult, applicationResult] = await Promise.all([
          supabase!.from("jobs").select("id, title").eq("created_by", profile.id).order("updated_at", { ascending: false }),
          supabase!.rpc("get_recruiter_interview_application_options", { p_limit: 100 }),
        ]);
        if (!mounted) return;
        if (!jobResult.error) {
          setJobs(
            ((jobResult.data ?? []) as Array<{ id?: string | null; title?: string | null }>).flatMap((row) =>
              row.id ? [{ id: row.id, title: row.title?.trim() || "Untitled role" }] : [],
            ),
          );
        }
        if (!applicationResult.error) {
          setApplicationOptions(
            ((applicationResult.data ?? []) as Array<{ application_id?: string | null; candidate_full_name?: string | null; job_id?: string | null; job_title?: string | null; application_status?: string | null }>).flatMap((row) => row.application_id && row.job_id ? [{ applicationId: row.application_id, applicationStatus: row.application_status ?? "applied", candidateName: row.candidate_full_name?.trim() || "Unknown Candidate", jobId: row.job_id, jobTitle: row.job_title?.trim() || "Untitled role" }] : []),
          );
        }
      } catch (loadError) {
        if (process.env.NODE_ENV === "development") console.error("[interviews] options load failed", loadError);
      }
    }
    void loadOptions();
    return () => { mounted = false; };
  }, [profile.id]);

  const loadDetail = useCallback(async (interviewId: string) => {
    if (!supabase) return;
    setSelectedId(interviewId);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [detailResult, eventsResult] = await Promise.all([
        supabase.rpc("get_recruiter_interview_detail", { p_interview_id: interviewId }),
        supabase.rpc("get_recruiter_interview_events", { p_interview_id: interviewId }),
      ]);
      if (detailResult.error) throw detailResult.error;
      const detail = mapInterviewRow(((detailResult.data ?? []) as InterviewRow[])[0] ?? {});
      if (!detail) throw new Error("Interview not found");
      setSelectedDetail(detail);
      setEvents(((eventsResult.data ?? []) as InterviewEventRow[]).flatMap((row) => {
        const mapped = mapInterviewEventRow(row);
        return mapped ? [mapped] : [];
      }));
    } catch (loadError) {
      if (process.env.NODE_ENV === "development") console.error("[interviews] detail load failed", loadError);
      setSelectedDetail(null);
      setEvents([]);
      setDetailError(getFriendlyError(loadError));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  async function refreshAfterMutation() {
    await loadInterviews();
    if (selectedId) await loadDetail(selectedId);
  }

  async function completeAction(reason: string) {
    if (!supabase || !selectedInterview || !reasonAction || isUpdating) return;
    setIsUpdating(true);
    try {
      const { error: actionError } = await supabase.rpc("update_recruiter_interview_status", {
        p_interview_id: selectedInterview.id,
        p_note: reason,
        p_status: reasonAction,
      });
      if (actionError) throw actionError;
      showSuccessToast(reasonAction === "completed" ? "Interview marked completed." : "Interview marked as no-show.");
      setReasonAction(null);
      await refreshAfterMutation();
    } catch (actionError) {
      showErrorToast(getFriendlyError(actionError));
    } finally {
      setIsUpdating(false);
    }
  }

  async function cancelInterview(reason: string) {
    if (!supabase || !selectedInterview || isUpdating) return;
    setIsUpdating(true);
    try {
      const { error: cancelError } = await supabase.rpc("cancel_recruiter_interview", {
        p_cancellation_reason: reason,
        p_interview_id: selectedInterview.id,
      });
      if (cancelError) throw cancelError;
      showSuccessToast("Interview cancelled.");
      setReasonAction(null);
      await refreshAfterMutation();
    } catch (cancelError) {
      showErrorToast(getFriendlyError(cancelError));
    } finally {
      setIsUpdating(false);
    }
  }

  function clearFilters() {
    router.push("/interviews");
  }

  const selectedApplicationOption = selectedInterview
    ? applicationOptions.find((item) => item.applicationId === selectedInterview.applicationId)
    : null;

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12 lg:px-12">
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Recruiter workspace</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">Interviews</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-500">Schedule, reschedule, and track interviews for applicants on your jobs.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200" href="/applications">View Applicants</Link>
            <button className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={() => setScheduleMode("create")} type="button">Schedule Interview</button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Interview views">
          {interviewViews.map((item) => (
            <button className={`inline-flex h-10 items-center rounded-xl border px-4 text-sm font-semibold capitalize focus:outline-none focus:ring-4 focus:ring-yellow-200 ${view === item ? "border-yellow-400 bg-yellow-50 text-gray-900" : "border-gray-200 bg-white text-gray-600"}`} key={item} onClick={() => updateUrl({ view: item, page: 1 })} role="tab" aria-selected={view === item} type="button">{item}</button>
          ))}
        </div>

        <form className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(17,24,39,0.08)]" onSubmit={(event) => { event.preventDefault(); updateUrl({ q: (event.currentTarget.elements.namedItem("search") as HTMLInputElement).value, from: dateFromDraft, to: dateToDraft, page: 1 }); }}>
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr]">
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Search</span><input defaultValue={searchParam} name="search" placeholder="Candidate name or job title" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" type="search" /></label>
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Status</span><select className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" value={status} onChange={(event) => updateUrl({ status: event.target.value, page: 1 })}><option value="">All statuses</option>{interviewStatuses.map((item) => <option key={item} value={item}>{getInterviewStatusLabel(item)}</option>)}</select></label>
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Type</span><select className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" value={interviewType} onChange={(event) => updateUrl({ type: event.target.value, page: 1 })}><option value="">All types</option>{interviewTypes.map((item) => <option key={item} value={item}>{getInterviewTypeLabel(item)}</option>)}</select></label>
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Job</span><select className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" value={jobParam} onChange={(event) => updateUrl({ job: event.target.value, page: 1 })}><option value="">All jobs</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">From</span><input className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" onChange={(event) => setDateFromDraft(event.target.value)} type="date" value={dateFromDraft} /></label>
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">To</span><input className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" onChange={(event) => setDateToDraft(event.target.value)} type="date" value={dateToDraft} /></label>
            <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Sort</span><select className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" value={sort} onChange={(event) => updateUrl({ sort: event.target.value, page: 1 })}><option value="soonest">Soonest first</option><option value="latest">Latest first</option><option value="updated">Recently updated</option></select></label>
            <div className="flex items-end gap-3"><button className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200" type="submit">Apply</button><button className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={clearFilters} type="button">Reset</button></div>
          </div>
        </form>

        {error ? <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-7 text-center"><h2 className="text-lg font-bold text-red-900">Interviews unavailable</h2><p className="mt-2 text-sm leading-6 text-red-800">{error}</p><button className="mt-5 inline-flex h-11 items-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={() => void loadInterviews()} type="button">Retry</button></div> : null}
        {!error && isLoading ? <div aria-busy="true" className="mt-8 h-72 animate-pulse rounded-2xl border border-gray-200 bg-white" /> : null}
        {!error && !isLoading && interviews.length === 0 ? <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]"><h2 className="text-xl font-bold text-gray-900">{view === "upcoming" ? "No upcoming interviews" : "No interviews found"}</h2><p className="mt-3 text-sm leading-6 text-gray-500">{view === "upcoming" ? "Schedule an interview from an applicant detail view to see it here." : "Try clearing filters or review applicants to schedule the next interview."}</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link className="inline-flex h-11 items-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200" href="/applications">View Applicants</Link><button className="inline-flex h-11 items-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={() => setScheduleMode("create")} type="button">Schedule Interview</button></div></div> : null}

        {!error && !isLoading && interviews.length > 0 ? <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="min-w-0 rounded-2xl border border-gray-200 bg-white shadow-[0_18px_45px_rgba(17,24,39,0.08)]"><div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4"><p className="text-sm font-semibold text-gray-500">{totalCount} interview{totalCount === 1 ? "" : "s"}</p><span className="text-xs font-medium text-gray-500">{view[0].toUpperCase() + view.slice(1)}</span></div><div className="grid gap-3 p-4">
            {interviews.map((interview) => <button className={`w-full rounded-xl border p-4 text-left transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-200 ${selectedId === interview.id ? "border-yellow-400 bg-yellow-50/70" : "border-gray-200 bg-white hover:border-yellow-300 hover:bg-yellow-50/30"}`} key={interview.id} onClick={() => void loadDetail(interview.id)} type="button"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-start gap-3"><CandidateAvatar imageUrl={interview.candidateAvatarUrl} name={interview.candidateName} /><div className="min-w-0"><p className="truncate font-bold text-gray-900" title={interview.candidateName}>{interview.candidateName}</p><p className="mt-1 break-words text-sm font-semibold text-gray-700">{interview.jobTitle}</p><p className="mt-2 text-xs font-medium text-gray-500">{formatInterviewDateTime(interview.scheduledStart, interview.timezone)} · {getInterviewTypeLabel(interview.interviewType)}</p></div></div><InterviewStatusBadge status={interview.status} /></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-gray-500"><span>{interview.timezone}</span><span>{interview.location ?? interview.meetingLink ?? interview.phoneNumber ?? "Details in interview"}</span></div></button>)}
          </div><div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm font-medium text-gray-500">Page {pageParam} of {totalPages}</span><div className="flex gap-2"><button className="inline-flex h-10 items-center rounded-xl border border-gray-200 px-4 text-sm font-semibold disabled:opacity-40" disabled={pageParam <= 1} onClick={() => updateUrl({ page: pageParam - 1 })} type="button">Previous</button><button className="inline-flex h-10 items-center rounded-xl border border-gray-200 px-4 text-sm font-semibold disabled:opacity-40" disabled={pageParam >= totalPages} onClick={() => updateUrl({ page: pageParam + 1 })} type="button">Next</button></div></div></section>

          <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_18px_45px_rgba(17,24,39,0.08)]">{detailLoading ? <div aria-busy="true" className="h-80 animate-pulse rounded-xl bg-gray-50" /> : detailError ? <div className="rounded-xl border border-red-200 bg-red-50 p-5"><p className="text-sm leading-6 text-red-800">{detailError}</p><button className="mt-4 text-sm font-bold text-red-900 underline focus:outline-none focus:ring-4 focus:ring-red-200" onClick={() => selectedId && void loadDetail(selectedId)} type="button">Retry</button></div> : selectedInterview ? <div><div className="flex items-start gap-3"><CandidateAvatar imageUrl={selectedInterview.candidateAvatarUrl} name={selectedInterview.candidateName} size="md" /><div className="min-w-0"><h2 className="break-words text-xl font-bold text-gray-900">{selectedInterview.candidateName}</h2><p className="mt-1 break-all text-xs text-gray-500">{selectedInterview.candidateEmail}</p></div></div><div className="mt-5 flex flex-wrap items-center gap-2"><InterviewStatusBadge status={selectedInterview.status} /><span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">{getInterviewTypeLabel(selectedInterview.interviewType)}</span></div><h3 className="mt-5 text-lg font-bold text-gray-900">{selectedInterview.jobTitle}</h3><p className="mt-1 text-sm text-gray-500">{selectedInterview.companyName}</p><div className="mt-5 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm"><div><span className="font-bold text-gray-900">When</span><p className="mt-1 text-gray-600">{formatInterviewDateTime(selectedInterview.scheduledStart, selectedInterview.timezone)}</p><p className="text-xs text-gray-500">Ends {formatInterviewDateTime(selectedInterview.scheduledEnd, selectedInterview.timezone)} · {selectedInterview.timezone}</p></div>{selectedInterview.location ? <div><span className="font-bold text-gray-900">Location</span><p className="mt-1 break-words text-gray-600">{selectedInterview.location}</p></div> : null}{selectedInterview.phoneNumber ? <div><span className="font-bold text-gray-900">Phone</span><p className="mt-1 text-gray-600">{selectedInterview.phoneNumber}</p></div> : null}{selectedInterview.meetingLink ? <div><span className="font-bold text-gray-900">Meeting link</span><a className="mt-1 block truncate font-semibold text-gray-700 underline decoration-yellow-400 underline-offset-4" href={selectedInterview.meetingLink} rel="noreferrer" target="_blank">Open secure meeting link</a></div> : null}</div>{selectedInterview.candidateInstructions ? <section className="mt-5"><h3 className="text-sm font-bold text-gray-900">Candidate instructions</h3><p className="mt-2 whitespace-pre-line break-words rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-600">{selectedInterview.candidateInstructions}</p></section> : null}{selectedInterview.recruiterNotes ? <section className="mt-5"><h3 className="text-sm font-bold text-gray-900">Private recruiter notes</h3><p className="mt-2 whitespace-pre-line break-words rounded-xl border border-yellow-200 bg-yellow-50/60 p-4 text-sm leading-6 text-gray-700">{selectedInterview.recruiterNotes}</p></section> : null}<div className="mt-5 flex flex-wrap gap-2"><Link className="inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200" href={`/applications?applicationId=${encodeURIComponent(selectedInterview.applicationId)}`}>Open application</Link>{selectedInterview.jobSlug ? <Link className="inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200" href={`/jobs/${encodeURIComponent(selectedInterview.jobSlug)}`}>Open job</Link> : null}</div><div className="mt-5 grid gap-2 sm:grid-cols-2">{selectedInterview.status === "scheduled" ? <><button className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-xs font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={() => setScheduleMode("reschedule")} type="button">Reschedule</button><button className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-700 focus:outline-none focus:ring-4 focus:ring-red-200" onClick={() => setReasonAction("cancel")} type="button">Cancel interview</button><button className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={() => setReasonAction("completed")} type="button">Mark completed</button><button className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={() => setReasonAction("no_show")} type="button">Mark no-show</button></> : null}</div><section className="mt-6"><h3 className="text-sm font-bold text-gray-900">Interview history</h3>{events.length > 0 ? <ol className="mt-3 grid gap-3">{events.map((event) => <li className="rounded-xl border border-gray-200 bg-gray-50 p-3" key={event.id}><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-gray-900">{formatEventLabel(event.eventType)}</span><time className="text-[11px] text-gray-500" dateTime={event.createdAt}>{formatDate(event.createdAt)}</time></div><p className="mt-1 text-xs text-gray-500">By {event.actorName}</p>{event.note ? <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-gray-600">{event.note}</p> : null}</li>)}</ol> : <p className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">Interview history is not available.</p>}</section><p className="mt-5 text-xs text-gray-500">Created {formatDate(selectedInterview.createdAt)} · Updated {formatDate(selectedInterview.updatedAt)}</p></div> : <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center"><h2 className="text-base font-bold text-gray-900">Select an interview</h2><p className="mt-2 text-sm leading-6 text-gray-500">Choose an interview to review details and manage its lifecycle.</p></div>}</aside>
        </div> : null}
      </section>

      {scheduleMode ? <InterviewScheduleDialog applications={applicationOptions} interview={scheduleMode === "reschedule" ? selectedInterview : null} initialApplicationId={selectedApplicationOption?.applicationId} onClose={() => setScheduleMode(null)} onSaved={() => { setScheduleMode(null); void refreshAfterMutation(); }} /> : null}
      {reasonAction === "cancel" ? <InterviewReasonDialog confirmLabel="Cancel interview" description="This preserves the interview record and application, but removes the interview from active scheduling." isBusy={isUpdating} onCancel={() => setReasonAction(null)} onConfirm={(reason) => void cancelInterview(reason)} placeholder="Why is this interview being cancelled?" title="Cancel interview?" /> : null}
      {reasonAction === "completed" || reasonAction === "no_show" ? <InterviewReasonDialog confirmLabel={reasonAction === "completed" ? "Mark completed" : "Mark no-show"} description="This records the interview outcome without changing the candidate's hiring application status." isBusy={isUpdating} onCancel={() => setReasonAction(null)} onConfirm={(reason) => void completeAction(reason)} placeholder="Add an internal outcome note" title={reasonAction === "completed" ? "Mark interview completed?" : "Mark interview as no-show?"} /> : null}
    </main>
  );
}
