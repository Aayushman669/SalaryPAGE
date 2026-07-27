"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/auth-context";
import {
  employmentTypes,
  formatEmploymentType,
  formatSalary,
  formatWorkplaceType,
  isEmploymentType,
  isWorkplaceType,
  workplaceTypes,
  type Salary,
} from "@/lib/jobs";
import {
  getRecruiterJobCreatedFilterLabel,
  getRecruiterJobFilterLabel,
  getRecruiterJobSortLabel,
  normalizeRecruiterJobCreatedFilter,
  normalizeRecruiterJobFilter,
  normalizeRecruiterJobSort,
  type RecruiterJobCreatedFilter,
  type RecruiterJobFilter,
  type RecruiterJobSort,
} from "@/lib/recruiter-job-filters";
import {
  type RecruiterJobListItem,
  type RecruiterJobsResponse,
} from "@/lib/recruiter-jobs";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

const filterOptions: RecruiterJobFilter[] = [
  "all",
  "active",
  "scheduled",
  "draft",
  "closed",
  "expired",
  "archived",
  "pending",
];

const createdFilterOptions: RecruiterJobCreatedFilter[] = [
  "all",
  "today",
  "seven_days",
  "thirty_days",
  "ninety_days",
];

const sortOptions: RecruiterJobSort[] = [
  "newest",
  "oldest",
  "applications",
  "updated",
  "alphabetical",
];

const statusStyles: Record<RecruiterJobListItem["status"], string> = {
  active: "border-green-200 bg-green-50 text-green-800",
  archived: "border-gray-300 bg-gray-100 text-gray-700",
  closed: "border-gray-200 bg-gray-50 text-gray-700",
  draft: "border-yellow-200 bg-yellow-50 text-yellow-900",
  expired: "border-red-200 bg-red-50 text-red-800",
  pending: "border-blue-200 bg-blue-50 text-blue-800",
  scheduled: "border-yellow-200 bg-yellow-50 text-yellow-900",
  unknown: "border-gray-200 bg-gray-50 text-gray-700",
};

type JobAction = "duplicate" | "close" | "reopen" | "delete";

type PendingAction = {
  action: JobAction;
  job: RecruiterJobListItem;
};

type JobActionResponse = {
  error?: string;
  message?: string;
};

type UrlValues = {
  created?: RecruiterJobCreatedFilter;
  employment?: string;
  page?: number;
  query?: string;
  sort?: RecruiterJobSort;
  status?: RecruiterJobFilter;
  workplace?: string;
};

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function formatStatus(value: RecruiterJobListItem["status"]) {
  return value === "active"
    ? "Active"
    : value.charAt(0).toUpperCase() + value.slice(1);
}

function updateJobsUrl(current: URLSearchParams, values: UrlValues) {
  const next = new URLSearchParams(current.toString());

  if (values.status) next.set("status", values.status);
  if (values.page && values.page > 1) next.set("page", String(values.page));
  else if (values.page !== undefined) next.delete("page");

  if (values.query?.trim()) next.set("q", values.query.trim());
  else if (values.query !== undefined) next.delete("q");

  if (values.created && values.created !== "all") next.set("created", values.created);
  else if (values.created !== undefined) next.delete("created");

  if (values.sort && values.sort !== "newest") next.set("sort", values.sort);
  else if (values.sort !== undefined) next.delete("sort");

  if (values.employment) next.set("employment", values.employment);
  else if (values.employment !== undefined) next.delete("employment");

  if (values.workplace) next.set("workplace", values.workplace);
  else if (values.workplace !== undefined) next.delete("workplace");

  const queryString = next.toString();
  return queryString ? `/jobs?${queryString}` : "/jobs";
}

function getActionTitle(action: JobAction) {
  return {
    close: "Close this job?",
    delete: "Remove this job?",
    duplicate: "Duplicate this job?",
    reopen: "Reopen this job?",
  }[action];
}

function getActionDescription(action: JobAction, job: RecruiterJobListItem) {
  if (action === "close") {
    return `${job.title} will stop accepting new applications. Existing applications will be preserved.`;
  }

  if (action === "reopen") {
    return `${job.title} will be restored as an active job and made available to candidates.`;
  }

  if (action === "duplicate") {
    return `${job.title} will be copied into a new draft. The original job will not change.`;
  }

  return job.status === "draft"
    ? `${job.title} will be permanently deleted. This cannot be undone.`
    : `${job.title} will be archived and removed from recruiter workflows. Existing applications will be preserved.`;
}

function getEmploymentLabel(value: string) {
  return isEmploymentType(value) ? formatEmploymentType(value) : value;
}

function getWorkplaceLabel(value: string) {
  return isWorkplaceType(value) ? formatWorkplaceType(value) : value;
}

function getSalaryLabel(job: RecruiterJobListItem) {
  if (!job.salary.visible || (job.salary.min === null && job.salary.max === null)) {
    return null;
  }

  const salary: Salary = {
    currency: job.salary.currency,
    max: job.salary.max,
    min: job.salary.min,
    visible: true,
  };

  return formatSalary(salary);
}

export default function RecruiterJobsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthLoading, isLoggedIn } = useAuth();
  const status = normalizeRecruiterJobFilter(searchParams.get("status"));
  const query = searchParams.get("q") ?? "";
  const created = normalizeRecruiterJobCreatedFilter(searchParams.get("created"));
  const sort = normalizeRecruiterJobSort(searchParams.get("sort"));
  const employment = searchParams.get("employment") ?? "";
  const workplace = searchParams.get("workplace") ?? "";
  const page = Number(searchParams.get("page")) || 1;
  const [result, setResult] = useState<RecruiterJobsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchTimerRef = useRef<number | null>(null);

  function navigate(values: UrlValues) {
    router.push(updateJobsUrl(searchParams, values));
  }

  function handleSearchChange(value: string) {
    if (searchTimerRef.current) {
      window.clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = window.setTimeout(() => {
      router.push(
        updateJobsUrl(new URLSearchParams(window.location.search), {
          page: 1,
          query: value,
        }),
      );
    }, 300);
  }

  const load = useCallback(async () => {
    if (isAuthLoading) return;

    if (!isLoggedIn) {
      setLoading(false);
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    if (!supabase) {
      setError("Jobs are unavailable because Supabase is not configured.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;

      if (!token) {
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }

      const params = new URLSearchParams({
        created,
        page: String(page),
        sort,
        status,
      });
      if (query) params.set("q", query);
      if (employment) params.set("employment", employment);
      if (workplace) params.set("workplace", workplace);

      const response = await fetch(`/api/recruiter/jobs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await response.json()) as RecruiterJobsResponse;

      if (response.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }

      if (!response.ok) {
        throw new Error(body.error || "We could not load your jobs.");
      }

      setResult(body);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "We could not load your jobs. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [created, employment, isAuthLoading, isLoggedIn, page, query, router, sort, status, workplace]);

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(loadId);
  }, [load]);

  useEffect(() => {
    if (!pendingAction) return;

    confirmButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !actionLoading) {
        setPendingAction(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actionLoading, pendingAction]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    navigate({ page: 1, query: String(formData.get("query") ?? "") });
  }

  async function confirmAction() {
    if (!pendingAction || actionLoading || !supabase) return;

    setActionLoading(true);

    try {
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;

      if (!token) {
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }

      const response = await fetch("/api/recruiter/jobs", {
        body: JSON.stringify({ action: pendingAction.action, jobId: pendingAction.job.id }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as JobActionResponse;

      if (response.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }

      if (!response.ok) {
        throw new Error(body.error || "We could not update this job.");
      }

      showSuccessToast("Job updated", body.message || "The job was updated successfully.");
      setPendingAction(null);
      await load();
      router.refresh();
    } catch (actionError) {
      showErrorToast(
        "Job action failed",
        actionError instanceof Error ? actionError.message : "Please try again.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (isAuthLoading || (loading && !result)) {
    return (
      <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
        <section className="mx-auto w-full max-w-6xl animate-pulse space-y-5">
          <div className="h-10 w-56 rounded-xl bg-gray-100" />
          <div className="h-28 rounded-2xl bg-gray-100" />
          <div className="h-40 rounded-2xl bg-gray-100" />
          <div className="h-40 rounded-2xl bg-gray-100" />
        </section>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:bg-white/5">
          <h1 className="text-xl font-bold">Login required</h1>
          <p className="mt-3 text-sm leading-6 text-gray-500">Log in to view your recruiter jobs.</p>
          <Link href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`} className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200">Login</Link>
        </section>
      </main>
    );
  }

  if (error && !result) {
    return (
      <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:bg-white/5">
          <h1 className="text-xl font-bold">Jobs unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-gray-500">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200">Retry</button>
        </section>
      </main>
    );
  }

  const heading = getRecruiterJobFilterLabel(status);
  const hasFilters = Boolean(query || employment || workplace || created !== "all");

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <section className="mx-auto flex w-full max-w-6xl flex-col">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Recruiter jobs</p>
            <h1 className="mt-3 break-words text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{heading}</h1>
            <p className="mt-2 text-sm leading-6 text-gray-500">Only jobs owned by your recruiter account are shown.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/post-job" className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200">Post a Job</Link>
            <Link href="/dashboard" className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5">Back to Dashboard</Link>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(17,24,39,0.06)] dark:bg-white/5">
          <form onSubmit={handleSearch} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
            <label className="grid gap-2 lg:row-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Search your jobs</span>
              <input key={query} name="query" defaultValue={query} onChange={(event) => handleSearchChange(event.target.value)} placeholder="Title, location, or employment type" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100" />
              <span className="text-xs text-gray-500">Search updates automatically.</span>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Status</span>
              <select value={status} onChange={(event) => navigate({ page: 1, status: normalizeRecruiterJobFilter(event.target.value) })} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100">
                {filterOptions.map((value) => <option key={value} value={value}>{getRecruiterJobFilterLabel(value)}</option>)}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Sort</span>
              <select value={sort} onChange={(event) => navigate({ page: 1, sort: normalizeRecruiterJobSort(event.target.value) })} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100">
                {sortOptions.map((value) => <option key={value} value={value}>{getRecruiterJobSortLabel(value)}</option>)}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Employment</span>
              <select value={employment} onChange={(event) => navigate({ page: 1, employment: event.target.value })} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100">
                <option value="">All employment types</option>
                {employmentTypes.map((value) => <option key={value} value={value}>{formatEmploymentType(value)}</option>)}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Workplace</span>
              <select value={workplace} onChange={(event) => navigate({ page: 1, workplace: event.target.value })} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100">
                <option value="">All workplace types</option>
                {workplaceTypes.map((value) => <option key={value} value={value}>{formatWorkplaceType(value)}</option>)}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Date created</span>
              <select value={created} onChange={(event) => navigate({ page: 1, created: normalizeRecruiterJobCreatedFilter(event.target.value) })} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100">
                {createdFilterOptions.map((value) => <option key={value} value={value}>{getRecruiterJobCreatedFilterLabel(value)}</option>)}
              </select>
            </label>
            <button type="submit" className="sr-only">Search jobs</button>
          </form>
        </div>

        <div className="mt-5 flex min-h-6 items-center justify-between gap-3 text-sm text-gray-500" aria-live="polite">
          <span>{loading ? "Refreshing jobs…" : result ? `${result.pagination.total} job${result.pagination.total === 1 ? "" : "s"}` : ""}</span>
          {error ? <span className="text-red-600">{error}</span> : null}
        </div>

        {result?.data.length ? (
          <div className="mt-3 grid gap-4">
            {result.data.map((job) => {
              const salary = getSalaryLabel(job);
              const canClose = job.status === "active" || job.status === "scheduled" || job.status === "expired" || job.status === "pending";
              const canReopen = job.status === "closed" || job.status === "archived" || job.status === "expired";

              return (
                <article key={job.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(17,24,39,0.06)] dark:bg-white/5 sm:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[job.status]}`}>{formatStatus(job.status)}</span>
                        {job.moderationStatus !== "active" ? <span className="text-xs font-semibold text-gray-500">Restricted from public view</span> : null}
                      </div>
                      <h2 className="mt-3 break-words text-lg font-bold text-gray-900">{job.title}</h2>
                      <p className="mt-1 break-words text-sm font-semibold text-gray-600">{job.companyName}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span>{job.location}</span>
                        <span>{getEmploymentLabel(job.employmentType)}</span>
                        <span>{getWorkplaceLabel(job.workplaceType)}</span>
                        {salary ? <span>{salary}</span> : null}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-gray-500">
                        <span>{job.applicationsCount} applications</span>
                        <span>Created {formatDate(job.createdAt)}</span>
                        <span>Updated {formatDate(job.updatedAt ?? job.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 xl:max-w-[430px] xl:justify-end">
                      {job.status === "active" && job.slug ? <Link href={`/jobs/${encodeURIComponent(job.slug)}`} className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5">View</Link> : null}
                      <Link href={`/applications?jobId=${encodeURIComponent(job.id)}`} className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5">Applicants</Link>
                      <Link href={`/post-job?edit=${encodeURIComponent(job.id)}`} className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5">Edit</Link>
                      <button type="button" onClick={() => setPendingAction({ action: "duplicate", job })} className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5">Duplicate</button>
                      {canClose ? <button type="button" onClick={() => setPendingAction({ action: "close", job })} className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5">Close</button> : null}
                      {canReopen ? <button type="button" onClick={() => setPendingAction({ action: "reopen", job })} className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200">Reopen</button> : null}
                      <button type="button" onClick={() => setPendingAction({ action: "delete", job })} className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 focus:outline-none focus:ring-4 focus:ring-red-200">{job.status === "draft" ? "Delete" : "Archive"}</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-8 text-center dark:bg-white/5">
            <h2 className="text-lg font-bold text-gray-900">{hasFilters ? "No matching jobs" : "No jobs posted yet."}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">{hasFilters ? "Try changing your search or filters." : "Create your first job to start building your hiring pipeline."}</p>
            {hasFilters ? <button type="button" onClick={() => navigate({ created: "all", employment: "", page: 1, query: "", sort: "newest", status: "all", workplace: "" })} className="mt-5 inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white/5">Clear filters</button> : <Link href="/post-job" className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200">Post Your First Job</Link>}
          </div>
        )}

        {result && result.pagination.totalPages > 1 ? (
          <nav aria-label="Recruiter jobs pagination" className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-gray-500">Page {result.pagination.page} of {result.pagination.totalPages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || loading} onClick={() => navigate({ page: page - 1 })} className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-4 focus:ring-yellow-200">Previous</button>
              <button type="button" disabled={page >= result.pagination.totalPages || loading} onClick={() => navigate({ page: page + 1 })} className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-4 focus:ring-yellow-200">Next</button>
            </div>
          </nav>
        ) : null}
      </section>

      {pendingAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5" role="presentation">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="job-action-title" aria-describedby="job-action-description">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Confirm job action</p>
            <h2 id="job-action-title" className="mt-3 text-xl font-bold text-gray-900">{getActionTitle(pendingAction.action)}</h2>
            <p id="job-action-description" className="mt-3 text-sm leading-6 text-gray-600">{getActionDescription(pendingAction.action, pendingAction.job)}</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setPendingAction(null)} disabled={actionLoading} className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:opacity-50">Cancel</button>
              <button ref={confirmButtonRef} type="button" onClick={() => void confirmAction()} disabled={actionLoading} className={`inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${pendingAction.action === "delete" || pendingAction.action === "close" ? "bg-red-600 focus:ring-red-200" : "bg-black focus:ring-yellow-200"}`}>
                {actionLoading ? "Working..." : pendingAction.action === "delete" ? (pendingAction.job.status === "draft" ? "Delete draft" : "Archive job") : getActionTitle(pendingAction.action).replace("?", "")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
