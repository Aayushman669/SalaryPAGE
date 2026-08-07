"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProfileRow } from "@/lib/auth-profiles";
import {
  formatInterviewDateTime,
  getInterviewStatusLabel,
  getInterviewTypeLabel,
  interviewSorts,
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
  type InterviewSort,
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

type InterviewFilters = {
  dateFrom: string;
  dateTo: string;
  interviewType: InterviewType | "";
  jobId: string;
  page: number;
  search: string;
  sort: InterviewSort;
  status: InterviewStatus | "";
  view: InterviewView;
};

type SummaryCounts = {
  cancelled: number;
  completed: number;
  upcoming: number;
};

type FilterKey = "dateFrom" | "dateTo" | "interviewType" | "jobId" | "search" | "sort" | "status";

type ActiveFilter = {
  key: FilterKey;
  label: string;
};

const pageSize = 20;
const searchDebounceMs = 420;
const interviewTabViews = ["upcoming", "completed", "cancelled", "all"] as const;

type InterviewTab = (typeof interviewTabViews)[number];

const defaultFilters: InterviewFilters = {
  dateFrom: "",
  dateTo: "",
  interviewType: "",
  jobId: "",
  page: 1,
  search: "",
  sort: "soonest",
  status: "",
  view: "upcoming",
};

function isInterviewView(value: string | null): value is InterviewView {
  return interviewViews.includes(value as InterviewView);
}

function isInterviewSort(value: string | null): value is InterviewSort {
  return interviewSorts.includes(value as InterviewSort);
}

function isInterviewStatusValue(value: string): value is InterviewStatus {
  return interviewStatuses.includes(value as InterviewStatus);
}

function isInterviewTypeValue(value: string): value is InterviewType {
  return interviewTypes.includes(value as InterviewType);
}

function isValidDateParam(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseFilters(searchParams: URLSearchParams): InterviewFilters {
  const view = searchParams.get("view");
  const sort = searchParams.get("sort");
  const status = searchParams.get("status") ?? "";
  const interviewType = searchParams.get("type") ?? "";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";
  const parsedPage = Number(searchParams.get("page"));
  const parsedView = isInterviewView(view) ? view : defaultFilters.view;

  return {
    dateFrom: isValidDateParam(dateFrom) ? dateFrom : "",
    dateTo: isValidDateParam(dateTo) ? dateTo : "",
    interviewType: isInterviewTypeValue(interviewType) ? interviewType : "",
    jobId: searchParams.get("job") ?? "",
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1,
    search: searchParams.get("q") ?? "",
    sort: isInterviewSort(sort) ? sort : defaultFilters.sort,
    status: isInterviewStatusValue(status) ? status : "",
    view: parsedView === "past" ? "all" : parsedView,
  };
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
  if (status === "scheduled") return "border-yellow-300 bg-yellow-50 text-yellow-900";
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "cancelled") return "border-red-200 bg-red-50 text-red-800";
  return "border-gray-300 bg-gray-100 text-gray-800";
}

function InterviewStatusBadge({ status }: { status: InterviewStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusClass(status)}`}>
      {getInterviewStatusLabel(status)}
    </span>
  );
}

function getInterviewTab(filters: InterviewFilters): InterviewTab {
  if (filters.view === "upcoming" && !filters.status) return "upcoming";
  if (filters.view === "cancelled" && !filters.status) return "cancelled";
  if (filters.view === "all" && filters.status === "completed") return "completed";
  return "all";
}

function SummaryCard({ label, value, note }: { label: string; note: string; value: number | null }) {
  return (
    <article className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-[0_10px_30px_rgba(17,24,39,0.05)]">
      <div className="flex items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{value === null ? "-" : value}</p>
      <p className="mt-1 text-xs text-gray-500">{note}</p>
    </article>
  );
}

function InterviewListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading interviews" className="grid gap-3 p-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="h-28 animate-pulse rounded-xl border border-gray-200 bg-gray-50" key={index} />
      ))}
    </div>
  );
}

function getActiveFilters(filters: InterviewFilters, jobs: JobOption[], activeTab: InterviewTab): ActiveFilter[] {
  const jobTitle = jobs.find((job) => job.id === filters.jobId)?.title ?? "Selected job";
  const active: ActiveFilter[] = [];
  if (filters.search) active.push({ key: "search", label: `Search: ${filters.search}` });
  if (filters.status && !(activeTab === "completed" && filters.status === "completed")) active.push({ key: "status", label: `Status: ${getInterviewStatusLabel(filters.status)}` });
  if (filters.interviewType) active.push({ key: "interviewType", label: `Type: ${getInterviewTypeLabel(filters.interviewType)}` });
  if (filters.jobId) active.push({ key: "jobId", label: `Job: ${jobTitle}` });
  if (filters.dateFrom) active.push({ key: "dateFrom", label: `From: ${filters.dateFrom}` });
  if (filters.dateTo) active.push({ key: "dateTo", label: `To: ${filters.dateTo}` });
  if (filters.sort !== defaultFilters.sort) active.push({ key: "sort", label: filters.sort === "latest" ? "Sort: Latest" : "Sort: Recently updated" });
  return active;
}

export default function RecruiterInterviews({ profile }: { profile: ProfileRow }) {
  const searchParams = useSearchParams();
  const initialFilters = useMemo(() => parseFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  const [filters, setFilters] = useState<InterviewFilters>(initialFilters);
  const [applicationOptions, setApplicationOptions] = useState<InterviewApplicationOption[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [summary, setSummary] = useState<SummaryCounts | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<InterviewEvent[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Interview | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"create" | "reschedule" | null>(null);
  const [reasonAction, setReasonAction] = useState<"cancel" | "completed" | "no_show" | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const filterRef = useRef(initialFilters);
  const handledSearchParamsRef = useRef(searchParams.toString());
  const requestIdRef = useRef(0);
  const selectedIdRef = useRef<string | null>(null);
  const searchDebounceRef = useRef<number | null>(null);

  const selectedInterview = selectedDetail ?? interviews.find((item) => item.id === selectedId) ?? null;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const activeTab = getInterviewTab(filters);
  const activeFilters = useMemo(() => getActiveFilters(filters, jobs, activeTab), [activeTab, filters, jobs]);
  const activeAdvancedCount = activeFilters.filter((item) => ["dateFrom", "dateTo", "interviewType", "jobId", "sort"].includes(item.key)).length;
  const hasActiveFilters = activeFilters.length > 0;

  const updateUrl = useCallback((nextFilters: InterviewFilters) => {
    if (typeof window === "undefined") return;
    const nextParams = new URLSearchParams(window.location.search);
    const values: Record<string, string | number> = {
      from: nextFilters.dateFrom,
      job: nextFilters.jobId,
      page: nextFilters.page,
      q: nextFilters.search,
      sort: nextFilters.sort,
      status: nextFilters.status,
      to: nextFilters.dateTo,
      type: nextFilters.interviewType,
      view: nextFilters.view,
    };
    Object.entries(values).forEach(([key, value]) => {
      const isDefault = value === "" || (key === "page" && value === 1) || (key === "sort" && value === defaultFilters.sort) || (key === "view" && value === defaultFilters.view);
      if (isDefault) nextParams.delete(key);
      else nextParams.set(key, String(value));
    });
    const query = nextParams.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  const loadInterviews = useCallback(async (nextFilters: InterviewFilters) => {
    const requestId = ++requestIdRef.current;
    if (!supabase) {
      setError("Supabase is not configured. Please check your environment variables.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.rpc("get_recruiter_interviews", {
        p_date_from: nextFilters.dateFrom || null,
        p_date_to: nextFilters.dateTo || null,
        p_interview_type: nextFilters.interviewType || null,
        p_job_id: nextFilters.jobId || null,
        p_limit: pageSize,
        p_offset: (nextFilters.page - 1) * pageSize,
        p_search: nextFilters.search,
        p_sort: nextFilters.sort,
        p_status: nextFilters.status || null,
        p_view: nextFilters.view,
      });
      if (fetchError) throw fetchError;
      // A newer request must always win, including explicit reloads triggered
      // by tab changes, browser navigation, or retry actions.
      if (requestId !== requestIdRef.current) return;
      const nextInterviews = ((data ?? []) as InterviewRow[]).flatMap((row) => {
        const mapped = mapInterviewRow(row);
        return mapped ? [mapped] : [];
      });
      setInterviews(nextInterviews);
      setTotalCount(Number((data as Array<{ total_count?: number | null }> | null)?.[0]?.total_count ?? 0));
      if (!nextInterviews.some((item) => item.id === selectedIdRef.current)) {
        selectedIdRef.current = null;
        setSelectedId(null);
        setSelectedDetail(null);
        setEvents([]);
      }
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      if (process.env.NODE_ENV === "development") console.error("[interviews] list load failed", loadError);
      setError(getFriendlyError(loadError));
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    if (!supabase) {
      setSummaryError(true);
      setIsSummaryLoading(false);
      return;
    }
    setIsSummaryLoading(true);
    setSummaryError(false);
    const base = {
      p_date_from: null,
      p_date_to: null,
      p_interview_type: null,
      p_job_id: null,
      p_limit: 1,
      p_offset: 0,
      p_search: "",
      p_sort: "soonest",
      p_view: "all",
    };
    try {
      const readCount = async (params: Record<string, unknown>) => {
        const { data, error: countError } = await supabase!.rpc("get_recruiter_interviews", { ...base, ...params });
        if (countError) throw countError;
        return Number((data as Array<{ total_count?: number | null }> | null)?.[0]?.total_count ?? 0);
      };
      const [upcoming, completed, cancelled] = await Promise.all([
        readCount({ p_view: "upcoming" }),
        readCount({ p_status: "completed" }),
        readCount({ p_status: "cancelled" }),
      ]);
      setSummary({ cancelled, completed, upcoming });
    } catch (summaryLoadError) {
      if (process.env.NODE_ENV === "development") console.error("[interviews] summary load failed", summaryLoadError);
      setSummaryError(true);
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (interviewId: string) => {
    if (!supabase) return;
    selectedIdRef.current = interviewId;
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

  useEffect(() => {
    void loadInterviews(filterRef.current);
    void loadSummary();

    function handlePopState() {
      handledSearchParamsRef.current = window.location.search.replace(/^\?/, "");
      const nextFilters = parseFilters(new URLSearchParams(window.location.search));
      filterRef.current = nextFilters;
      setFilters(nextFilters);
      void loadInterviews(nextFilters);
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      requestIdRef.current += 1;
      if (searchDebounceRef.current !== null) window.clearTimeout(searchDebounceRef.current);
    };
  }, [loadInterviews, loadSummary]);

  useEffect(() => {
    const nextSearchParams = searchParams.toString();
    if (nextSearchParams === handledSearchParamsRef.current) return;
    handledSearchParamsRef.current = nextSearchParams;
    const nextFilters = parseFilters(new URLSearchParams(nextSearchParams));
    filterRef.current = nextFilters;
    setFilters(nextFilters);
    void loadInterviews(nextFilters);
  }, [loadInterviews, searchParams]);

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
      } catch (optionsError) {
        if (process.env.NODE_ENV === "development") console.error("[interviews] options load failed", optionsError);
      }
    }
    void loadOptions();
    return () => { mounted = false; };
  }, [profile.id]);

  async function refreshAfterMutation() {
    await Promise.all([loadInterviews(filterRef.current), loadSummary()]);
    if (selectedIdRef.current) await loadDetail(selectedIdRef.current);
  }

  function commitFilters(patch: Partial<InterviewFilters>, shouldLoad = true) {
    const nextFilters = { ...filterRef.current, ...patch };
    if (patch.page === undefined) nextFilters.page = 1;
    filterRef.current = nextFilters;
    setFilters(nextFilters);
    updateUrl(nextFilters);
    if (shouldLoad) void loadInterviews(nextFilters);
  }

  function handleSearchChange(value: string) {
    commitFilters({ search: value }, false);
    if (searchDebounceRef.current !== null) window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => {
      void loadInterviews(filterRef.current);
    }, searchDebounceMs);
  }

  function handleSearchSubmit() {
    if (searchDebounceRef.current !== null) window.clearTimeout(searchDebounceRef.current);
    void loadInterviews(filterRef.current);
  }

  function clearFilters() {
    const nextFilters = { ...defaultFilters };
    filterRef.current = nextFilters;
    setFilters(nextFilters);
    setIsMoreFiltersOpen(false);
    updateUrl(nextFilters);
    void loadInterviews(nextFilters);
  }

  function clearFilter(key: FilterKey) {
    const patch: Partial<InterviewFilters> = key === "sort" ? { sort: defaultFilters.sort } : { [key]: "" };
    commitFilters(patch);
  }

  function selectInterview(interview: Interview) {
    selectedIdRef.current = interview.id;
    setSelectedId(interview.id);
    setSelectedDetail(interview);
    void loadDetail(interview.id);
  }

  function startStatusAction(interview: Interview, action: "cancel" | "completed" | "no_show") {
    selectedIdRef.current = interview.id;
    setSelectedId(interview.id);
    setSelectedDetail(interview);
    setReasonAction(action);
  }

  async function startReschedule(interview: Interview) {
    await loadDetail(interview.id);
    setScheduleMode("reschedule");
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

  const selectedApplicationOption = selectedInterview
    ? applicationOptions.find((item) => item.applicationId === selectedInterview.applicationId)
    : null;

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12 lg:px-12">
      <section className="mx-auto w-full max-w-7xl">
        <header className="flex flex-col gap-5 pb-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Recruiter workspace</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">Interviews</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-500">Manage upcoming, completed, and cancelled interviews for applicants on your jobs.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button aria-label="Schedule interview" className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={() => setScheduleMode("create")} type="button">+ Schedule Interview</button>
          </div>
        </header>

        <section aria-label="Interview summary" className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard label="Upcoming" note="Future scheduled" value={isSummaryLoading ? null : summary?.upcoming ?? null} />
          <SummaryCard label="Completed" note="Finished interviews" value={isSummaryLoading ? null : summary?.completed ?? null} />
          <SummaryCard label="Cancelled" note="Cancelled records" value={isSummaryLoading ? null : summary?.cancelled ?? null} />
        </section>
        {summaryError ? <p className="mt-3 text-right text-xs text-gray-500">Summary counts are temporarily unavailable.</p> : null}

        <div className="mt-6 flex max-w-full flex-wrap gap-2" role="tablist" aria-label="Interview views">
          {interviewTabViews.map((item) => (
            <button
              aria-controls="interview-results"
              aria-selected={activeTab === item}
              className={`inline-flex h-10 items-center rounded-lg border px-4 text-sm font-semibold capitalize transition focus:outline-none focus:ring-4 focus:ring-yellow-200 ${activeTab === item ? "border-yellow-400 bg-yellow-50 text-gray-900" : "border-transparent bg-transparent text-gray-500 hover:border-gray-700 hover:bg-gray-900 hover:text-white"}`}
              key={item}
              onClick={() => commitFilters(item === "upcoming" ? { view: "upcoming", status: "", page: 1 } : item === "completed" ? { view: "all", status: "completed", page: 1 } : item === "cancelled" ? { view: "cancelled", status: "", page: 1 } : { view: "all", status: "", page: 1 })}
              role="tab"
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        <form
          aria-label="Filter interviews"
          className="mt-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-[0_14px_38px_rgba(17,24,39,0.06)] sm:p-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearchSubmit();
          }}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem_auto] lg:items-end">
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Search</span>
              <input aria-label="Search candidate or job title" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400 transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" onChange={(event) => handleSearchChange(event.target.value)} placeholder="Search candidate or job title" type="search" value={filters.search} />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Status</span>
              <select aria-label="Filter by status" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" onChange={(event) => commitFilters({ status: event.target.value as InterviewFilters["status"] })} value={filters.status}>
                <option value="">All statuses</option>
                {interviewStatuses.map((item) => <option key={item} value={item}>{getInterviewStatusLabel(item)}</option>)}
              </select>
            </label>
            <button aria-expanded={isMoreFiltersOpen} aria-controls="advanced-interview-filters" className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition hover:border-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={() => setIsMoreFiltersOpen((open) => !open)} type="button">
              Filters{activeAdvancedCount > 0 ? ` (${activeAdvancedCount})` : ""}
              <span aria-hidden="true" className="ml-2 text-gray-500">{isMoreFiltersOpen ? "-" : "+"}</span>
            </button>
          </div>

          {isMoreFiltersOpen ? (
            <div className="mt-4 grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-5" id="advanced-interview-filters">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Interview type</span>
                <select aria-label="Filter by interview type" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" onChange={(event) => commitFilters({ interviewType: event.target.value as InterviewFilters["interviewType"] })} value={filters.interviewType}>
                  <option value="">All types</option>
                  {interviewTypes.map((item) => <option key={item} value={item}>{getInterviewTypeLabel(item)}</option>)}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Job</span>
                <select aria-label="Filter by job" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" onChange={(event) => commitFilters({ jobId: event.target.value })} value={filters.jobId}>
                  <option value="">All jobs</option>
                  {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">From date</span>
                <input aria-label="Filter from date" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" onChange={(event) => commitFilters({ dateFrom: event.target.value })} type="date" value={filters.dateFrom} />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">To date</span>
                <input aria-label="Filter to date" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" onChange={(event) => commitFilters({ dateTo: event.target.value })} type="date" value={filters.dateTo} />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Sort</span>
                <select aria-label="Sort interviews" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" onChange={(event) => commitFilters({ sort: event.target.value as InterviewSort })} value={filters.sort}>
                  <option value="soonest">Soonest first</option>
                  <option value="latest">Latest first</option>
                  <option value="updated">Recently updated</option>
                </select>
              </label>
            </div>
          ) : null}

          {activeFilters.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
              {activeFilters.map((activeFilter) => (
                <button aria-label={`Remove ${activeFilter.label}`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-yellow-400 hover:bg-yellow-50 focus:outline-none focus:ring-4 focus:ring-yellow-100" key={activeFilter.key} onClick={() => clearFilter(activeFilter.key)} type="button">
                  <span className="truncate">{activeFilter.label}</span>
                  <span aria-hidden="true" className="text-gray-400">x</span>
                </button>
              ))}
              <button className="ml-1 text-xs font-bold text-gray-600 underline decoration-yellow-400 underline-offset-4 transition hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-100" onClick={clearFilters} type="button">Clear filters</button>
            </div>
          ) : null}
        </form>

        <div className="mt-5 flex min-h-5 items-center justify-between gap-3" aria-live="polite">
          <p className="text-xs font-medium text-gray-500">{isLoading ? "Updating interviews..." : `Showing ${totalCount} interview${totalCount === 1 ? "" : "s"}`}</p>
          {isLoading && interviews.length > 0 ? <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" /> : null}
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
            <h2 className="text-lg font-bold text-red-900">Interviews unavailable</h2>
            <p className="mt-2 text-sm leading-6 text-red-800">{error}</p>
            <button className="mt-4 inline-flex h-10 items-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={() => void loadInterviews(filterRef.current)} type="button">Retry</button>
          </div>
        ) : null}

        <section aria-busy={isLoading} className={`mt-3 ${isLoading && interviews.length > 0 ? "opacity-60" : ""}`} id="interview-results">
          {!error && isLoading && interviews.length === 0 ? <div className="rounded-2xl border border-gray-200 bg-white shadow-[0_14px_38px_rgba(17,24,39,0.06)]"><InterviewListSkeleton /></div> : null}

          {!error && !isLoading && interviews.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-[0_14px_38px_rgba(17,24,39,0.06)]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-yellow-300 bg-yellow-50 text-lg font-bold text-yellow-900" aria-hidden="true">I</div>
              <h2 className="mt-5 text-xl font-bold text-gray-900">{hasActiveFilters ? "No interviews match these filters" : activeTab === "upcoming" ? "No interviews scheduled" : `No ${activeTab} interviews`}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-500">{hasActiveFilters ? "Try clearing a filter or choosing a different view." : activeTab === "upcoming" ? "Scheduled interviews will appear here once you invite applicants." : "Interview records in this view will appear here when they are available."}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {hasActiveFilters ? <button className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={clearFilters} type="button">Clear filters</button> : <button aria-label="Schedule interview" className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={() => setScheduleMode("create")} type="button">+ Schedule Interview</button>}
              </div>
            </div>
          ) : null}

          {!error && interviews.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
              <section className="min-w-0 rounded-2xl border border-gray-200 bg-white shadow-[0_14px_38px_rgba(17,24,39,0.06)]">
                <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Interview schedule</h2>
                    <p className="mt-1 text-xs text-gray-500">Select an interview to review its details.</p>
                  </div>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">{activeTab}</span>
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-full text-left">
                    <thead className="border-b border-gray-200 bg-gray-50/80">
                      <tr className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
                        <th className="px-5 py-3">Candidate</th>
                        <th className="px-3 py-3">Job</th>
                        <th className="px-3 py-3">Date and time</th>
                        <th className="px-3 py-3">Type</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {interviews.map((interview) => (
                        <tr className={`transition-colors ${selectedId === interview.id ? "bg-yellow-50/60" : "hover:bg-gray-50"}`} key={interview.id}>
                          <td className="px-5 py-4 align-top">
                            <div className="flex min-w-48 items-start gap-3">
                              <CandidateAvatar imageUrl={interview.candidateAvatarUrl} name={interview.candidateName} />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-gray-900" title={interview.candidateName}>{interview.candidateName}</p>
                                <p className="mt-1 max-w-44 truncate text-xs text-gray-500" title={interview.candidateEmail}>{interview.candidateEmail}</p>
                              </div>
                            </div>
                          </td>
                          <td className="max-w-48 px-3 py-4 align-top text-sm font-semibold text-gray-700">{interview.jobTitle}</td>
                          <td className="min-w-44 px-3 py-4 align-top">
                            <p className="text-sm font-semibold text-gray-900">{formatInterviewDateTime(interview.scheduledStart, interview.timezone)}</p>
                            <p className="mt-1 text-xs text-gray-500">Ends {new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone: interview.timezone }).format(new Date(interview.scheduledEnd))}</p>
                          </td>
                          <td className="px-3 py-4 align-top text-sm text-gray-600">{getInterviewTypeLabel(interview.interviewType)}</td>
                          <td className="px-3 py-4 align-top"><InterviewStatusBadge status={interview.status} /></td>
                          <td className="px-5 py-4 align-top text-right">
                            <div className="flex justify-end gap-2">
                              <button aria-label={`View details for ${interview.candidateName}`} className="inline-flex h-9 items-center rounded-lg bg-black px-3 text-xs font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={() => selectInterview(interview)} type="button">View details</button>
                              <InterviewActionMenu interview={interview} onCancel={() => startStatusAction(interview, "cancel")} onComplete={() => startStatusAction(interview, "completed")} onNoShow={() => startStatusAction(interview, "no_show")} onReschedule={() => void startReschedule(interview)} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 p-4 lg:hidden">
                  {interviews.map((interview) => (
                    <article className={`rounded-xl border p-4 transition-colors ${selectedId === interview.id ? "border-yellow-400 bg-yellow-50/60" : "border-gray-200 bg-white"}`} key={interview.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <CandidateAvatar imageUrl={interview.candidateAvatarUrl} name={interview.candidateName} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-gray-900">{interview.candidateName}</p>
                            <p className="mt-1 truncate text-xs text-gray-500">{interview.candidateEmail}</p>
                          </div>
                        </div>
                        <InterviewStatusBadge status={interview.status} />
                      </div>
                      <div className="mt-4 grid gap-2 text-sm">
                        <p className="font-semibold text-gray-900">{interview.jobTitle}</p>
                        <p className="text-gray-600">{formatInterviewDateTime(interview.scheduledStart, interview.timezone)}</p>
                        <p className="text-xs text-gray-500">{getInterviewTypeLabel(interview.interviewType)} - {interview.timezone}</p>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <button aria-label={`View details for ${interview.candidateName}`} className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-black px-3 text-xs font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={() => selectInterview(interview)} type="button">View details</button>
                        <InterviewActionMenu interview={interview} onCancel={() => startStatusAction(interview, "cancel")} onComplete={() => startStatusAction(interview, "completed")} onNoShow={() => startStatusAction(interview, "no_show")} onReschedule={() => void startReschedule(interview)} />
                      </div>
                    </article>
                  ))}
                </div>

                {totalPages > 1 ? (
                  <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-medium text-gray-500">Page {filters.page} of {totalPages}</span>
                    <div className="flex gap-2">
                      <button className="inline-flex h-10 items-center rounded-lg border border-gray-200 px-4 text-xs font-semibold text-gray-700 transition hover:border-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-40" disabled={filters.page <= 1 || isLoading} onClick={() => commitFilters({ page: filters.page - 1 })} type="button">Previous</button>
                      <button className="inline-flex h-10 items-center rounded-lg border border-gray-200 px-4 text-xs font-semibold text-gray-700 transition hover:border-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-40" disabled={filters.page >= totalPages || isLoading} onClick={() => commitFilters({ page: filters.page + 1 })} type="button">Next</button>
                    </div>
                  </div>
                ) : null}
              </section>

              <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_14px_38px_rgba(17,24,39,0.06)] lg:sticky lg:top-6" aria-label="Interview details">
                {detailLoading ? <div aria-busy="true" className="h-80 animate-pulse rounded-xl bg-gray-50" /> : detailError ? <div className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert"><p className="text-sm leading-6 text-red-800">{detailError}</p><button className="mt-4 text-sm font-bold text-red-900 underline decoration-yellow-400 underline-offset-4 focus:outline-none focus:ring-4 focus:ring-red-200" onClick={() => selectedId && void loadDetail(selectedId)} type="button">Retry</button></div> : selectedInterview ? <InterviewDetails interview={selectedInterview} events={events} isUpdating={isUpdating} onCancel={() => setReasonAction("cancel")} onComplete={() => setReasonAction("completed")} onNoShow={() => setReasonAction("no_show")} onReschedule={() => setScheduleMode("reschedule")} /> : <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-bold text-gray-500" aria-hidden="true">I</div><h2 className="mt-4 text-base font-bold text-gray-900">Select an interview</h2><p className="mt-2 text-sm leading-6 text-gray-500">Choose an interview to review its details and manage its lifecycle.</p></div>}
              </aside>
            </div>
          ) : null}
        </section>
      </section>

      {scheduleMode ? <InterviewScheduleDialog applications={applicationOptions} interview={scheduleMode === "reschedule" ? selectedInterview : null} initialApplicationId={selectedApplicationOption?.applicationId} onClose={() => setScheduleMode(null)} onSaved={() => { setScheduleMode(null); void refreshAfterMutation(); }} /> : null}
      {reasonAction === "cancel" ? <InterviewReasonDialog confirmLabel="Cancel interview" description="This preserves the interview record and application, but removes the interview from active scheduling." isBusy={isUpdating} onCancel={() => setReasonAction(null)} onConfirm={(reason) => void cancelInterview(reason)} placeholder="Why is this interview being cancelled?" title="Cancel interview?" /> : null}
      {reasonAction === "completed" || reasonAction === "no_show" ? <InterviewReasonDialog confirmLabel={reasonAction === "completed" ? "Mark completed" : "Mark no-show"} description="This records the interview outcome without changing the candidate's hiring application status." isBusy={isUpdating} onCancel={() => setReasonAction(null)} onConfirm={(reason) => void completeAction(reason)} placeholder="Add an internal outcome note" title={reasonAction === "completed" ? "Mark interview completed?" : "Mark interview as no-show?"} /> : null}
    </main>
  );
}

function InterviewActionMenu({
  interview,
  onCancel,
  onComplete,
  onNoShow,
  onReschedule,
}: {
  interview: Interview;
  onCancel: () => void;
  onComplete: () => void;
  onNoShow: () => void;
  onReschedule: () => void;
}) {
  if (interview.status !== "scheduled") {
    return <span className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-500">No actions</span>;
  }

  return (
    <details className="relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-gray-400 focus:outline-none focus:ring-4 focus:ring-yellow-200">
        More
      </summary>
      <div className="absolute right-0 z-20 mt-2 grid min-w-44 gap-1 rounded-xl border border-gray-200 bg-white p-1.5 text-left shadow-[0_16px_40px_rgba(17,24,39,0.16)]">
        <button className="rounded-lg px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-200" onClick={onReschedule} type="button">Reschedule</button>
        <button className="rounded-lg px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-200" onClick={onComplete} type="button">Mark completed</button>
        <button className="rounded-lg px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-200" onClick={onNoShow} type="button">Mark no-show</button>
        <button className="rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200" onClick={onCancel} type="button">Cancel interview</button>
      </div>
    </details>
  );
}

function InterviewDetails({
  events,
  interview,
  isUpdating,
  onCancel,
  onComplete,
  onNoShow,
  onReschedule,
}: {
  events: InterviewEvent[];
  interview: Interview;
  isUpdating: boolean;
  onCancel: () => void;
  onComplete: () => void;
  onNoShow: () => void;
  onReschedule: () => void;
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <CandidateAvatar imageUrl={interview.candidateAvatarUrl} name={interview.candidateName} size="md" />
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold text-gray-900">{interview.candidateName}</h2>
          <p className="mt-1 break-all text-xs text-gray-500">{interview.candidateEmail}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2"><InterviewStatusBadge status={interview.status} /><span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">{getInterviewTypeLabel(interview.interviewType)}</span></div>
      <h3 className="mt-5 text-lg font-bold text-gray-900">{interview.jobTitle}</h3>
      <p className="mt-1 text-sm text-gray-500">{interview.companyName}</p>
      <div className="mt-5 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
        <div><span className="font-bold text-gray-900">When</span><p className="mt-1 text-gray-600">{formatInterviewDateTime(interview.scheduledStart, interview.timezone)}</p><p className="text-xs text-gray-500">Ends {formatInterviewDateTime(interview.scheduledEnd, interview.timezone)} - {interview.timezone}</p></div>
        {interview.location ? <div><span className="font-bold text-gray-900">Location</span><p className="mt-1 break-words text-gray-600">{interview.location}</p></div> : null}
        {interview.phoneNumber ? <div><span className="font-bold text-gray-900">Phone</span><p className="mt-1 text-gray-600">{interview.phoneNumber}</p></div> : null}
        {interview.meetingLink ? <div><span className="font-bold text-gray-900">Meeting link</span><a className="mt-1 block truncate font-semibold text-gray-700 underline decoration-yellow-400 underline-offset-4" href={interview.meetingLink} rel="noreferrer" target="_blank">Open secure meeting link</a></div> : null}
      </div>
      {interview.candidateInstructions ? <section className="mt-5"><h3 className="text-sm font-bold text-gray-900">Candidate instructions</h3><p className="mt-2 whitespace-pre-line break-words rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-600">{interview.candidateInstructions}</p></section> : null}
      {interview.recruiterNotes ? <section className="mt-5"><h3 className="text-sm font-bold text-gray-900">Private recruiter notes</h3><p className="mt-2 whitespace-pre-line break-words rounded-xl border border-yellow-200 bg-yellow-50/60 p-4 text-sm leading-6 text-gray-700">{interview.recruiterNotes}</p></section> : null}
      <div className="mt-5 flex flex-wrap gap-2"><Link className="inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200" href={`/applications?applicationId=${encodeURIComponent(interview.applicationId)}`}>Open application</Link>{interview.jobSlug ? <Link className="inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200" href={`/jobs/${encodeURIComponent(interview.jobSlug)}`}>Open job</Link> : null}</div>
      {interview.status === "scheduled" ? <div className="mt-5 grid gap-2 sm:grid-cols-2"><button className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-xs font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:opacity-60" disabled={isUpdating} onClick={onReschedule} type="button">Reschedule</button><button className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-700 focus:outline-none focus:ring-4 focus:ring-red-200 disabled:opacity-60" disabled={isUpdating} onClick={onCancel} type="button">Cancel interview</button><button className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:opacity-60" disabled={isUpdating} onClick={onComplete} type="button">Mark completed</button><button className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:opacity-60" disabled={isUpdating} onClick={onNoShow} type="button">Mark no-show</button></div> : null}
      <section className="mt-6"><h3 className="text-sm font-bold text-gray-900">Interview history</h3>{events.length > 0 ? <ol className="mt-3 grid gap-3">{events.map((event) => <li className="rounded-xl border border-gray-200 bg-gray-50 p-3" key={event.id}><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-gray-900">{formatEventLabel(event.eventType)}</span><time className="text-[11px] text-gray-500" dateTime={event.createdAt}>{formatDate(event.createdAt)}</time></div><p className="mt-1 text-xs text-gray-500">By {event.actorName}</p>{event.note ? <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-gray-600">{event.note}</p> : null}</li>)}</ol> : <p className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">Interview history is not available.</p>}</section>
      <p className="mt-5 text-xs text-gray-500">Created {formatDate(interview.createdAt)} - Updated {formatDate(interview.updatedAt)}</p>
    </div>
  );
}
