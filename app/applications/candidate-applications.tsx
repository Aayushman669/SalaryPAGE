"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  applicationStatuses,
  canCandidateWithdrawApplication,
  getApplicationStatusDisplay,
  getApplicationWorkflowErrorMessage,
  mapApplicationStatusHistoryRow,
  normalizeApplicationStatus,
  type ApplicationStatusHistoryItem,
  type ApplicationStatusHistoryRow,
  type ApplicationStatusTransitionRow,
  type CandidateApplicationDetails,
  type CandidateApplicationJobDetails,
} from "@/lib/applications";
import {
  formatInterviewDateTime,
  getInterviewStatusLabel,
  getInterviewTypeLabel,
  mapCandidateInterviewRow,
  type CandidateInterview,
  type CandidateInterviewRow,
} from "@/lib/interviews";
import { safeHttpUrl } from "@/lib/input-safety";
import {
  formatEmploymentType,
  formatExperienceLevel,
  formatSalary,
  formatWorkplaceType,
  isEmploymentType,
  isExperienceLevel,
  isWorkplaceType,
  type Salary,
} from "@/lib/jobs";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import ApplicationConfirmationDialog from "./application-confirmation-dialog";
import ApplicationStatusBadge from "./application-status-badge";
import ApplicationStatusTimeline from "./application-status-timeline";
import CandidateAvatar from "./candidate-avatar";

type CandidateApplicationDashboardRow = {
  application_email?: string | null;
  application_url?: string | null;
  applied_at?: string | null;
  benefits?: string | null;
  category?: string | null;
  company_name?: string | null;
  cover_letter?: string | null;
  description?: string | null;
  employment_type?: string | null;
  experience_level?: string | null;
  id?: string | null;
  job_slug?: string | null;
  job_title?: string | null;
  location?: string | null;
  requirements?: string | null;
  resume_submitted?: boolean | null;
  salary_currency?: string | null;
  salary_max?: number | null;
  salary_min?: number | null;
  salary_visible?: boolean | null;
  status?: string | null;
  total_count?: number | null;
  updated_at?: string | null;
  workplace_type?: string | null;
};

type CandidateFilters = {
  company: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  status: string;
};

const pageSize = 10;
const initialFilters: CandidateFilters = {
  company: "",
  dateFrom: "",
  dateTo: "",
  search: "",
  status: "",
};

function normalizeText(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function normalizeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Recently applied";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently applied";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function normalizeSalary(row: CandidateApplicationDashboardRow): Salary {
  const currency = normalizeText(row.salary_currency, "USD").toUpperCase();

  return {
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
    max: normalizeNumber(row.salary_max),
    min: normalizeNumber(row.salary_min),
    visible: row.salary_visible ?? true,
  };
}

function mapJobDetails(row: CandidateApplicationDashboardRow): CandidateApplicationJobDetails {
  const employmentType = isEmploymentType(row.employment_type)
    ? formatEmploymentType(row.employment_type)
    : null;
  const workplaceType = isWorkplaceType(row.workplace_type)
    ? formatWorkplaceType(row.workplace_type)
    : null;
  const experienceLevel = isExperienceLevel(row.experience_level)
    ? formatExperienceLevel(row.experience_level)
    : null;

  return {
    applicationEmail: row.application_email?.trim() || null,
    applicationUrl: safeHttpUrl(row.application_url),
    benefits: row.benefits?.trim() ?? "",
    category: normalizeText(row.category, "General"),
    companyName: normalizeText(row.company_name, "Company"),
    description: row.description?.trim() ?? "",
    employmentType,
    experienceLevel,
    location: normalizeText(row.location, "Location not specified"),
    requirements: row.requirements?.trim() ?? "",
    salary: normalizeSalary(row),
    slug: normalizeText(row.job_slug, ""),
    title: normalizeText(row.job_title, "Untitled role"),
    workplaceType,
  };
}

function normalizeApplicationRow(
  row: CandidateApplicationDashboardRow,
): CandidateApplicationDetails {
  return {
    appliedAt: row.applied_at ?? null,
    coverLetter: row.cover_letter?.trim() ?? "",
    id: normalizeText(row.id, "application"),
    job: mapJobDetails(row),
    resumeSubmitted: row.resume_submitted === true,
    status: normalizeApplicationStatus(row.status),
    updatedAt: row.updated_at ?? null,
  };
}

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
      {children}
    </span>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
      <h2 className="text-lg font-bold text-gray-900">
        {filtered ? "No matching applications" : "No applications yet"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-gray-500">
        {filtered
          ? "Try adjusting your search or filters."
          : "Start applying to jobs and track your progress here."}
      </p>
      <Link
        className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200"
        href="/jobs"
      >
        Browse Jobs
      </Link>
    </div>
  );
}

function CandidateApplicationsLoading() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <section className="mx-auto w-full max-w-6xl">
        <div className="h-5 w-36 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-5 h-12 w-72 max-w-full animate-pulse rounded-xl bg-gray-100" />
        <div className="mt-10 grid gap-4">
          {[0, 1, 2].map((item) => (
            <div
              aria-hidden="true"
              className="h-36 animate-pulse rounded-2xl border border-gray-200 bg-white"
              key={item}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

export default function CandidateApplications() {
  const [applications, setApplications] = useState<CandidateApplicationDetails[]>(
    [],
  );
  const [draftFilters, setDraftFilters] =
    useState<CandidateFilters>(initialFilters);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CandidateFilters>(initialFilters);
  const [history, setHistory] = useState<ApplicationStatusHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isInterviewLoading, setIsInterviewLoading] = useState(false);
  const [interview, setInterview] = useState<CandidateInterview | null>(null);
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [withdrawTarget, setWithdrawTarget] =
    useState<CandidateApplicationDetails | null>(null);
  const requestIdRef = useRef(0);

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === selectedId) ?? null,
    [applications, selectedId],
  );
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasFilters = Object.values(filters).some(Boolean);

  const loadApplications = useCallback(async () => {
    if (!supabase) {
      setError(
        "Supabase is not configured. Please check your environment variables.",
      );
      setIsLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.rpc(
        "get_candidate_applications_dashboard",
        {
          p_company: filters.company || null,
          p_date_from: filters.dateFrom || null,
          p_date_to: filters.dateTo || null,
          p_limit: pageSize,
          p_offset: (page - 1) * pageSize,
          p_search: filters.search,
          p_status: filters.status || null,
        },
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (fetchError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[candidate-applications] fetch failed", fetchError);
        }

        setError(
          "We could not load your applications. Please run the latest candidate applications migration or try again soon.",
        );
        return;
      }

      const rows = (data ?? []) as CandidateApplicationDashboardRow[];
      const nextApplications = rows.map(normalizeApplicationRow);
      setApplications(nextApplications);
      setTotalCount(rows[0]?.total_count ?? 0);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.error("[candidate-applications] network failure", loadError);
      }

      setError(
        "We could not connect. Please check your internet connection and try again.",
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [filters, page]);

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      void loadApplications();
    }, 0);

    return () => {
      window.clearTimeout(loadId);
      requestIdRef.current += 1;
    };
  }, [loadApplications]);

  const loadSelectedHistory = useCallback(async (applicationId: string) => {
    if (!supabase) {
      setHistoryError("Status history is unavailable.");
      setIsHistoryLoading(false);
      return;
    }

    setIsHistoryLoading(true);
    setHistoryError(null);

    try {
      const { data, error: historyFetchError } = await supabase.rpc(
        "get_application_status_history",
        { p_application_id: applicationId },
      );

      if (historyFetchError) {
        if (process.env.NODE_ENV === "development") {
          console.error(
            "[candidate-applications] history fetch failed",
            historyFetchError,
          );
        }

        setHistory([]);
        setHistoryError("We could not load the status history.");
        return;
      }

      setHistory(
        ((data ?? []) as ApplicationStatusHistoryRow[])
          .map(mapApplicationStatusHistoryRow)
          .filter((item): item is ApplicationStatusHistoryItem => Boolean(item)),
      );
    } catch (historyLoadError) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[candidate-applications] history network failure",
          historyLoadError,
        );
      }

      setHistory([]);
      setHistoryError("We could not load the status history.");
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const loadSelectedInterview = useCallback(async (applicationId: string) => {
    if (!supabase) {
      setInterview(null);
      setInterviewError("Interview details are unavailable.");
      setIsInterviewLoading(false);
      return;
    }

    setIsInterviewLoading(true);
    setInterviewError(null);

    try {
      const { data, error: interviewFetchError } = await supabase.rpc(
        "get_candidate_interview_details",
        { p_application_id: applicationId },
      );
      if (interviewFetchError) throw interviewFetchError;
      setInterview(
        mapCandidateInterviewRow(
          ((data ?? []) as CandidateInterviewRow[])[0] ?? {},
        ),
      );
    } catch (interviewLoadError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[candidate-applications] interview fetch failed", interviewLoadError);
      }
      setInterview(null);
      setInterviewError("Interview details are temporarily unavailable.");
    } finally {
      setIsInterviewLoading(false);
    }
  }, []);

  function selectApplication(application: CandidateApplicationDetails) {
    setSelectedId(application.id);
    setHistory([]);
    setHistoryError(null);
    setInterview(null);
    setInterviewError(null);
    void loadSelectedHistory(application.id);
    void loadSelectedInterview(application.id);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters(draftFilters);
  }

  function resetFilters() {
    setDraftFilters(initialFilters);
    setFilters(initialFilters);
    setPage(1);
  }

  const closeWithdrawConfirmation = useCallback(() => {
    if (!isWithdrawing) {
      setWithdrawTarget(null);
    }
  }, [isWithdrawing]);

  async function withdrawApplication() {
    if (!supabase || !withdrawTarget || isWithdrawing) {
      return;
    }

    const application = withdrawTarget;
    const previousStatus = application.status;

    if (!canCandidateWithdrawApplication(previousStatus)) {
      showErrorToast("This application can no longer be withdrawn.");
      setWithdrawTarget(null);
      return;
    }

    setIsWithdrawing(true);
    setApplications((current) =>
      current.map((item) =>
        item.id === application.id ? { ...item, status: "withdrawn" } : item,
      ),
    );

    try {
      const { data, error: withdrawError } = await supabase.rpc(
        "withdraw_candidate_application",
        {
          p_application_id: application.id,
          p_expected_status: previousStatus,
        },
      );
      const transition = (
        (data ?? []) as ApplicationStatusTransitionRow[]
      )[0];

      if (
        withdrawError ||
        !transition?.history_id ||
        !transition.history_created_at
      ) {
        if (process.env.NODE_ENV === "development") {
          console.error("[candidate-applications] withdrawal failed", withdrawError);
        }

        throw withdrawError ?? new Error("Application withdrawal failed.");
      }

      const historyItem = mapApplicationStatusHistoryRow({
        application_id: application.id,
        changed_by_display: "You",
        changed_by_role: "job_seeker",
        created_at: transition.history_created_at,
        id: transition.history_id,
        new_status: "withdrawn",
        note: null,
        previous_status: previousStatus,
      });

      if (historyItem) {
        setHistory((current) => [historyItem, ...current]);
      }

      showSuccessToast("Application withdrawn.");
    } catch (withdrawError) {
      setApplications((current) =>
        current.map((item) =>
          item.id === application.id ? { ...item, status: previousStatus } : item,
        ),
      );
      showErrorToast(getApplicationWorkflowErrorMessage(withdrawError));
    } finally {
      setIsWithdrawing(false);
      setWithdrawTarget(null);
    }
  }

  if (isLoading && applications.length === 0) {
    return <CandidateApplicationsLoading />;
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <section className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
              Job Seeker Dashboard
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              My Applications
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-500">
              Track your applications and follow every step of your job search.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
            href="/jobs"
          >
            Browse Jobs
          </Link>
        </div>

        <form
          className="mt-10 rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(17,24,39,0.08)] sm:p-6"
          onSubmit={applyFilters}
        >
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <label className="grid gap-2">
              <FieldLabel>Search</FieldLabel>
              <input
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Job title or company"
                type="search"
                value={draftFilters.search}
              />
            </label>
            <label className="grid gap-2">
              <FieldLabel>Company</FieldLabel>
              <input
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    company: event.target.value,
                  }))
                }
                placeholder="Filter by company"
                value={draftFilters.company}
              />
            </label>
            <label className="grid gap-2">
              <FieldLabel>Status</FieldLabel>
              <select
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                value={draftFilters.status}
              >
                <option value="">All statuses</option>
                {applicationStatuses.map((status) => (
                  <option key={status} value={status}>
                    {getApplicationStatusDisplay(status).label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-2">
              <FieldLabel>Applied From</FieldLabel>
              <input
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    dateFrom: event.target.value,
                  }))
                }
                type="date"
                value={draftFilters.dateFrom}
              />
            </label>
            <label className="grid gap-2">
              <FieldLabel>Applied To</FieldLabel>
              <input
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    dateTo: event.target.value,
                  }))
                }
                type="date"
                value={draftFilters.dateTo}
              />
            </label>
            <div className="flex items-end gap-3">
              <button
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                onClick={resetFilters}
                type="button"
              >
                Reset
              </button>
              <button
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                type="submit"
              >
                Apply
              </button>
            </div>
          </div>
        </form>

        {error ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
            <h2 className="text-lg font-bold text-gray-900">
              Applications unavailable
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">{error}</p>
            <button
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-yellow-200"
              onClick={() => void loadApplications()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        {!error && !isLoading && applications.length === 0 ? (
          <EmptyState filtered={hasFilters} />
        ) : null}

        {!error && applications.length > 0 ? (
          <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <section className="min-w-0 rounded-2xl border border-gray-200 bg-white shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
              <div className="border-b border-gray-200 px-5 py-4">
                <p className="text-sm font-semibold text-gray-500">
                  {totalCount} application{totalCount === 1 ? "" : "s"}
                </p>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
                    <tr>
                      <th className="px-5 py-4">Company</th>
                      <th className="px-5 py-4">Role</th>
                      <th className="px-5 py-4">Applied</th>
                      <th className="px-5 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {applications.map((application) => (
                      <tr
                        className={`cursor-pointer transition-colors duration-200 hover:bg-yellow-50/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-yellow-300 ${
                          selectedId === application.id ? "bg-yellow-50/60" : ""
                        }`}
                        key={application.id}
                        onClick={() => selectApplication(application)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectApplication(application);
                          }
                        }}
                        tabIndex={0}
                      >
                        <td className="max-w-52 px-5 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <CandidateAvatar
                              ariaLabel="Company logo"
                              name={application.job?.companyName}
                            />
                            <div className="min-w-0">
                              <p
                                className="truncate font-bold text-gray-900"
                                title={application.job?.companyName}
                              >
                                {application.job?.companyName}
                              </p>
                              <p className="mt-1 truncate text-xs font-medium text-gray-500">
                                {application.job?.location}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-64 px-5 py-4">
                          <p className="break-words font-semibold text-gray-900">
                            {application.job?.title}
                          </p>
                          <p className="mt-1 text-xs font-medium text-gray-500">
                            {application.job?.employmentType ?? "Employment not specified"}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-500">
                          {formatDate(application.appliedAt)}
                        </td>
                        <td className="px-5 py-4">
                          <ApplicationStatusBadge status={application.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 p-4 md:hidden">
                {applications.map((application) => (
                  <button
                    className={`rounded-xl border p-4 text-left transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-yellow-200 ${
                      selectedId === application.id
                        ? "border-yellow-300 bg-yellow-50"
                        : "border-gray-200 bg-white"
                    }`}
                    key={application.id}
                    onClick={() => selectApplication(application)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <CandidateAvatar
                          ariaLabel="Company logo"
                          name={application.job?.companyName}
                        />
                        <div className="min-w-0">
                          <p
                            className="truncate font-bold text-gray-900"
                            title={application.job?.companyName}
                          >
                            {application.job?.companyName}
                          </p>
                          <p
                            className="mt-1 line-clamp-2 break-words text-sm font-semibold text-gray-600"
                            title={application.job?.title}
                          >
                            {application.job?.title}
                          </p>
                        </div>
                      </div>
                      <ApplicationStatusBadge
                        compact
                        status={application.status}
                      />
                    </div>
                    <p className="mt-3 text-xs font-medium text-gray-500">
                      {application.job?.location} &middot; Applied {formatDate(application.appliedAt)}
                    </p>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-gray-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-3">
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    disabled={page <= 1 || isLoading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={page >= totalPages || isLoading}
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>

            <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
              {selectedApplication ? (
                <div>
                  <div className="flex items-start gap-3">
                    <CandidateAvatar
                      ariaLabel="Company logo"
                      name={selectedApplication.job?.companyName}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                        Company
                      </p>
                      <h2
                        className="mt-1 break-words text-lg font-bold tracking-tight text-gray-900"
                        title={selectedApplication.job?.companyName}
                      >
                        {selectedApplication.job?.companyName}
                      </h2>
                      <p className="mt-1 break-words text-xs font-medium text-gray-500">
                        {selectedApplication.job?.location}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 text-sm">
                    <h3 className="break-words text-xl font-bold tracking-tight text-gray-900">
                      {selectedApplication.job?.title}
                    </h3>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold text-gray-500">
                      {selectedApplication.job?.employmentType ? (
                        <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5">
                          {selectedApplication.job.employmentType}
                        </span>
                      ) : null}
                      {selectedApplication.job?.workplaceType ? (
                        <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5">
                          {selectedApplication.job.workplaceType}
                        </span>
                      ) : null}
                      {selectedApplication.job?.experienceLevel ? (
                        <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5">
                          {selectedApplication.job.experienceLevel}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-gray-500">
                      Applied {formatDateTime(selectedApplication.appliedAt)}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <ApplicationStatusBadge status={selectedApplication.status} />
                    {canCandidateWithdrawApplication(selectedApplication.status) ? (
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-colors duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isWithdrawing}
                        onClick={() => setWithdrawTarget(selectedApplication)}
                        type="button"
                      >
                        Withdraw
                      </button>
                    ) : null}
                  </div>

                  <section className="mt-6">
                    <h3 className="text-sm font-bold text-gray-900">
                      Job Information
                    </h3>
                    <div className="mt-3 grid gap-3 text-sm">
                      <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 font-semibold text-gray-700">
                        {formatSalary(selectedApplication.job?.salary ?? {
                          currency: "USD",
                          max: null,
                          min: null,
                          visible: true,
                        })}
                      </p>
                      {selectedApplication.job?.category ? (
                        <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-600">
                          Category: {selectedApplication.job.category}
                        </p>
                      ) : null}
                    </div>
                  </section>

                  {selectedApplication.job?.description ? (
                    <section className="mt-6">
                      <h3 className="text-sm font-bold text-gray-900">
                        Description
                      </h3>
                      <p className="mt-2 whitespace-pre-line rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                        {selectedApplication.job.description}
                      </p>
                    </section>
                  ) : null}

                  {selectedApplication.job?.requirements ? (
                    <section className="mt-6">
                      <h3 className="text-sm font-bold text-gray-900">
                        Requirements
                      </h3>
                      <p className="mt-2 whitespace-pre-line rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                        {selectedApplication.job.requirements}
                      </p>
                    </section>
                  ) : null}

                  {selectedApplication.job?.benefits ? (
                    <section className="mt-6">
                      <h3 className="text-sm font-bold text-gray-900">
                        Benefits
                      </h3>
                      <p className="mt-2 whitespace-pre-line rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                        {selectedApplication.job.benefits}
                      </p>
                    </section>
                  ) : null}

                  <section className="mt-6">
                    <h3 className="text-sm font-bold text-gray-900">
                      Application Details
                    </h3>
                    <div className="mt-3 grid gap-3 text-sm">
                      <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-600">
                        Resume: {selectedApplication.resumeSubmitted ? "Submitted" : "Not available"}
                      </p>
                      <p className="whitespace-pre-line rounded-xl border border-gray-200 bg-gray-50 p-4 leading-6 text-gray-600">
                        {selectedApplication.coverLetter || "No cover letter provided."}
                      </p>
                    </div>
                  </section>

                  <section className="mt-6">
                    <h3 className="text-sm font-bold text-gray-900">
                      Interview Details
                    </h3>
                    {isInterviewLoading ? (
                      <div aria-busy="true" className="mt-3 h-28 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />
                    ) : interviewError ? (
                      <p className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-500">
                        {interviewError}
                      </p>
                    ) : interview ? (
                      <div className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50/60 p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-gray-900">
                            {getInterviewTypeLabel(interview.interviewType)}
                          </span>
                          <span className="rounded-full border border-yellow-300 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-800">
                            {getInterviewStatusLabel(interview.status)}
                          </span>
                        </div>
                        <p className="mt-3 font-semibold text-gray-800">
                          {formatInterviewDateTime(interview.scheduledStart, interview.timezone)}
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          Ends {formatInterviewDateTime(interview.scheduledEnd, interview.timezone)} · {interview.timezone}
                        </p>
                        {interview.location ? <p className="mt-3 break-words text-gray-700">Location: {interview.location}</p> : null}
                        {interview.phoneNumber ? <p className="mt-3 text-gray-700">Phone: {interview.phoneNumber}</p> : null}
                        {interview.meetingLink ? <a className="mt-3 inline-flex font-semibold text-gray-800 underline decoration-yellow-500 underline-offset-4 focus:outline-none focus:ring-4 focus:ring-yellow-200" href={interview.meetingLink} rel="noreferrer" target="_blank">Open meeting link</a> : null}
                        {interview.candidateInstructions ? <p className="mt-3 whitespace-pre-line break-words leading-6 text-gray-700">{interview.candidateInstructions}</p> : null}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-500">
                        No interview has been scheduled for this application.
                      </p>
                    )}
                  </section>

                  <section className="mt-6">
                    <h3 className="text-sm font-bold text-gray-900">
                      Status Timeline
                    </h3>
                    <div className="mt-3">
                      <ApplicationStatusTimeline
                        error={historyError}
                        history={history}
                        loading={isHistoryLoading}
                      />
                    </div>
                  </section>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                  <h2 className="text-base font-bold text-gray-900">
                    Select an application
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Choose an application to review the job details and status timeline.
                  </p>
                </div>
              )}
            </aside>
          </div>
        ) : null}
      </section>

      {withdrawTarget ? (
        <ApplicationConfirmationDialog
          confirmLabel="Withdraw Application"
          description="You will not be able to reactivate it after withdrawal."
          isBusy={isWithdrawing}
          onCancel={closeWithdrawConfirmation}
          onConfirm={() => void withdrawApplication()}
          title="Withdraw this application?"
        />
      ) : null}
    </main>
  );
}
