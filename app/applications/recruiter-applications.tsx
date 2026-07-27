"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ProfileRow } from "@/lib/auth-profiles";
import {
  getCandidateAssetUrl,
  getRecruiterCandidateProfile,
  type RecruiterCandidateProfile,
} from "@/lib/candidate-profile";
import {
  applicationResumeBucket,
  applicationStatuses,
  getRecruiterApplicationTagLabel,
  getApplicationWorkflowErrorMessage,
  getApplicationStatusDisplay,
  getRecruiterApplicationNextStatuses,
  mapApplicationStatusHistoryRow,
  recruiterApplicationTagValues,
  type ApplicationAnswers,
  type ApplicationRecruiterNote,
  type ApplicationStatusHistoryItem,
  type ApplicationStatusHistoryRow,
  type ApplicationStatusTransitionRow,
  type RecruiterApplicationStatus,
  type RecruiterApplicationTag,
} from "@/lib/applications";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import ApplicationStatusBadge from "./application-status-badge";
import ApplicationConfirmationDialog from "./application-confirmation-dialog";
import ApplicationStatusTimeline from "./application-status-timeline";
import CandidateAvatar from "./candidate-avatar";
import InterviewScheduleDialog from "@/app/interviews/interview-schedule-dialog";
import type { InterviewApplicationOption } from "@/lib/interviews";

type RecruiterApplicationSort =
  | "applied_asc"
  | "applied_desc"
  | "candidate_asc"
  | "candidate_desc"
  | "job_asc"
  | "status_asc"
  | "updated_desc";

type RecruiterApplicationRow = {
  answers?: ApplicationAnswers | null;
  applied_at?: string | null;
  candidate_avatar_url?: string | null;
  candidate_email?: string | null;
  candidate_full_name?: string | null;
  candidate_id?: string | null;
  candidate_experience?: string | null;
  candidate_location?: string | null;
  candidate_skills?: string[] | null;
  company_name?: string | null;
  cover_letter?: string | null;
  id?: string | null;
  job_id?: string | null;
  job_slug?: string | null;
  job_title?: string | null;
  notes?: string | null;
  resume_url?: string | null;
  status?: string | null;
  tags?: string[] | null;
  total_count?: number | null;
  updated_at?: string | null;
};

type RecruiterApplicationNoteRow = {
  application_id?: string | null;
  created_at?: string | null;
  id?: string | null;
  note?: string | null;
  recruiter_id?: string | null;
  updated_at?: string | null;
};

type RecruiterApplicationTagRow = {
  tag?: string | null;
};

type RecruiterJobOption = {
  id: string;
  title: string;
};

type RecruiterApplication = {
  answers: ApplicationAnswers;
  appliedAt: string | null;
  candidateAvatarUrl: string | null;
  candidateEmail: string;
  candidateId: string;
  candidateName: string;
  candidateExperience: string;
  candidateLocation: string;
  candidateSkills: string[];
  companyName: string;
  coverLetter: string;
  id: string;
  jobId: string;
  jobSlug: string;
  jobTitle: string;
  notes: string;
  resumePath: string | null;
  status: string;
  tags: RecruiterApplicationTag[];
  updatedAt: string | null;
};

type RecruiterApplicationSummary = {
  interviewsScheduled: number;
  newApplicants: number;
  shortlisted: number;
  totalApplicants: number;
};

type PendingStatusTransition = {
  application: RecruiterApplication;
  status: RecruiterApplicationStatus;
};

type Filters = {
  dateFrom: string;
  dateTo: string;
  candidateLocation: string;
  jobId: string;
  search: string;
  sort: RecruiterApplicationSort;
  status: string;
  resumeAvailable: string;
  tag: string;
};

const pageSize = 20;

const initialFilters: Filters = {
  dateFrom: "",
  dateTo: "",
  candidateLocation: "",
  jobId: "",
  search: "",
  sort: "applied_desc",
  status: "",
  resumeAvailable: "",
  tag: "",
};

const sortOptions: Array<{ label: string; value: RecruiterApplicationSort }> = [
  { label: "Newest", value: "applied_desc" },
  { label: "Oldest", value: "applied_asc" },
  { label: "Candidate A-Z", value: "candidate_asc" },
  { label: "Candidate Z-A", value: "candidate_desc" },
  { label: "Job A-Z", value: "job_asc" },
  { label: "Status A-Z", value: "status_asc" },
  { label: "Recently updated", value: "updated_desc" },
];

function isRecruiterApplicationTag(value: string): value is RecruiterApplicationTag {
  return recruiterApplicationTagValues.includes(value as RecruiterApplicationTag);
}

function mapRecruiterApplicationNotes(
  rows: RecruiterApplicationNoteRow[],
): ApplicationRecruiterNote[] {
  return rows.flatMap((row) => {
    if (!row.id || !row.application_id || !row.recruiter_id || !row.note) {
      return [];
    }

    return [
      {
        applicationId: row.application_id,
        createdAt: row.created_at ?? new Date().toISOString(),
        id: row.id,
        note: row.note,
        recruiterId: row.recruiter_id,
        updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
      },
    ];
  });
}

function mapRecruiterApplicationTags(
  rows: RecruiterApplicationTagRow[],
): RecruiterApplicationTag[] {
  return rows.flatMap((row) =>
    row.tag && isRecruiterApplicationTag(row.tag) ? [row.tag] : [],
  );
}

function normalizeText(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function mapRecruiterApplicationRow(
  row: RecruiterApplicationRow,
): RecruiterApplication {
  return {
    answers: row.answers ?? {},
    appliedAt: row.applied_at ?? null,
    candidateAvatarUrl: row.candidate_avatar_url ?? null,
    candidateEmail: normalizeText(row.candidate_email, "Email unavailable"),
    candidateId: normalizeText(row.candidate_id, "candidate"),
    candidateExperience: normalizeText(row.candidate_experience, "Experience unavailable"),
    candidateLocation: normalizeText(row.candidate_location, "Location unavailable"),
    candidateName: normalizeText(row.candidate_full_name, "Unknown Candidate"),
    candidateSkills: Array.isArray(row.candidate_skills)
      ? row.candidate_skills.filter((skill): skill is string => typeof skill === "string" && Boolean(skill.trim()))
      : [],
    companyName: normalizeText(row.company_name, "Company"),
    coverLetter: row.cover_letter?.trim() ?? "",
    id: normalizeText(row.id, "application"),
    jobId: normalizeText(row.job_id, "job"),
    jobSlug: normalizeText(row.job_slug, ""),
    jobTitle: normalizeText(row.job_title, "Unknown Job"),
    notes: row.notes ?? "",
    resumePath: row.resume_url?.trim() || null,
    status: row.status?.trim() || "unknown",
    tags: Array.isArray(row.tags)
      ? row.tags.filter(isRecruiterApplicationTag)
      : [],
    updatedAt: row.updated_at ?? null,
  };
}

function getAnswerEntries(answers: ApplicationAnswers) {
  return Object.entries(answers).filter(([, value]) => value !== null);
}

function renderAnswerValue(value: ApplicationAnswers[string]) {
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}

function FieldLabel({ children }: { children: string }) {
  return (
    <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
      {children}
    </span>
  );
}

function SelectField({
  children,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <FieldLabel>{label}</FieldLabel>
      <select
        className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

export default function RecruiterApplications({
  profile,
}: {
  profile: ProfileRow;
}) {
  const searchParams = useSearchParams();
  const initialApplicationId = searchParams.get("applicationId") ?? "";
  const initialJobId = searchParams.get("jobId") ?? "";
  const [applications, setApplications] = useState<RecruiterApplication[]>([]);
  const [candidateProfile, setCandidateProfile] =
    useState<RecruiterCandidateProfile | null>(null);
  const [candidateProfilePhotoUrl, setCandidateProfilePhotoUrl] = useState<
    string | null
  >(null);
  const [draftFilters, setDraftFilters] = useState<Filters>(() => ({
    ...initialFilters,
    jobId: initialJobId,
  }));
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(() => ({
    ...initialFilters,
    jobId: initialJobId,
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [history, setHistory] = useState<ApplicationStatusHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [jobs, setJobs] = useState<RecruiterJobOption[]>([]);
  const [notes, setNotes] = useState<ApplicationRecruiterNote[]>([]);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<RecruiterApplicationTag | "">("");
  const [isScheduleInterviewOpen, setIsScheduleInterviewOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pendingTransition, setPendingTransition] =
    useState<PendingStatusTransition | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<RecruiterApplicationSummary>({
    interviewsScheduled: 0,
    newApplicants: 0,
    shortlisted: 0,
    totalApplicants: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const candidateProfileRequestRef = useRef(0);
  const requestIdRef = useRef(0);

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === selectedId),
    [applications, selectedId],
  );
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasActiveFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.jobId ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.candidateLocation ||
      filters.resumeAvailable ||
      filters.tag,
  );

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
        "get_recruiter_application_management",
        {
          p_date_from: filters.dateFrom || null,
          p_date_to: filters.dateTo || null,
          p_job_id: filters.jobId || null,
          p_limit: pageSize,
          p_offset: (page - 1) * pageSize,
          p_search: filters.search,
          p_sort: filters.sort,
          p_status: filters.status || null,
          p_tag: filters.tag || null,
          p_resume_available:
            filters.resumeAvailable === ""
              ? null
              : filters.resumeAvailable === "yes",
          p_candidate_location: filters.candidateLocation || null,
        },
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (fetchError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[recruiter-applications] fetch failed", fetchError);
        }

        setError(
          "We could not load applicants. Please run the latest applications migration or try again soon.",
        );
        return;
      }

      const rows = (data ?? []) as RecruiterApplicationRow[];
      let nextApplications = rows.map(mapRecruiterApplicationRow);

      if (
        initialApplicationId &&
        !nextApplications.some(
          (application) => application.id === initialApplicationId,
        )
      ) {
        const { data: detailData, error: detailError } = await supabase.rpc(
          "get_recruiter_application_detail",
          { p_application_id: initialApplicationId },
        );

        if (!detailError) {
          const detailRow = (detailData ?? [])[0] as
            | RecruiterApplicationRow
            | undefined;
          const detailApplication = detailRow
            ? mapRecruiterApplicationRow(detailRow)
            : null;

          if (detailApplication?.id === initialApplicationId) {
            nextApplications = [...nextApplications, detailApplication];
          }
        }
      }

      setApplications(nextApplications);
      setTotalCount(rows[0]?.total_count ?? 0);

      setSelectedId((currentSelectedId) =>
        currentSelectedId &&
        nextApplications.some(
          (application) => application.id === currentSelectedId,
        )
          ? currentSelectedId
          : null,
      );
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.error("[recruiter-applications] network failure", loadError);
      }

      setError(
        "We could not connect. Please check your internet connection and try again.",
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [filters, initialApplicationId, page]);

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      void loadApplications();
    }, 0);

    return () => {
      window.clearTimeout(loadId);
      requestIdRef.current += 1;
    };
  }, [loadApplications]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    async function loadJobs() {
      const { data, error: fetchError } = await supabase!
        .from("jobs")
        .select("id, title")
        .eq("created_by", profile.id)
        .order("updated_at", { ascending: false });

      if (fetchError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[recruiter-applications] jobs fetch failed", fetchError);
        }

        return;
      }

      if (isMounted) {
        setJobs(
          ((data ?? []) as Array<{ id?: string | null; title?: string | null }>)
            .filter((job) => job.id)
            .map((job) => ({
              id: job.id ?? "",
              title: normalizeText(job.title, "Untitled job"),
            })),
        );
      }
    }

    void loadJobs();

    return () => {
      isMounted = false;
    };
  }, [profile.id]);

  const loadSummary = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const { data, error: summaryError } = await supabase.rpc(
      "get_recruiter_application_summary",
    );

    if (summaryError) {
      return;
    }

    const row = (data ?? [])[0] as
      | {
          interviews_scheduled?: number | null;
          new_applicants?: number | null;
          shortlisted?: number | null;
          total_applicants?: number | null;
        }
      | undefined;

    setSummary({
      interviewsScheduled: Number(row?.interviews_scheduled ?? 0),
      newApplicants: Number(row?.new_applicants ?? 0),
      shortlisted: Number(row?.shortlisted ?? 0),
      totalApplicants: Number(row?.total_applicants ?? 0),
    });
  }, []);

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      void loadSummary();
    }, 0);

    return () => window.clearTimeout(loadId);
  }, [loadSummary, profile.id]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters(draftFilters);
  }

  const selectApplication = useCallback((application: RecruiterApplication) => {
    candidateProfileRequestRef.current += 1;
    const candidateProfileRequestId = candidateProfileRequestRef.current;
    setCandidateProfile(null);
    setCandidateProfilePhotoUrl(null);
    setHistory([]);
    setHistoryError(null);
    setIsHistoryLoading(true);
    setNotes([]);
    setNotesError(null);
    setIsNotesLoading(true);
    setEditingNoteId(null);
    setSelectedTag("");
    setSelectedId(application.id);
    setNotesDraft("");
    void (async () => {
      const result = await getRecruiterCandidateProfile(application.candidateId);

      if (candidateProfileRequestId !== candidateProfileRequestRef.current) {
        return;
      }

      if (result.error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[recruiter-applications] candidate profile fetch failed", result.error);
        }
        return;
      }

      setCandidateProfile(result.candidateProfile);

      if (result.candidateProfile?.profile_photo_path) {
        const photoUrl = await getCandidateAssetUrl(
          result.candidateProfile.profile_photo_path,
        );

        if (candidateProfileRequestId === candidateProfileRequestRef.current) {
          setCandidateProfilePhotoUrl(photoUrl);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (!initialApplicationId || selectedId) {
      return;
    }

    const applicationFromUrl = applications.find(
      (application) => application.id === initialApplicationId,
    );

    if (applicationFromUrl) {
      const selectionId = window.setTimeout(() => {
        selectApplication(applicationFromUrl);
      }, 0);

      return () => window.clearTimeout(selectionId);
    }
  }, [applications, initialApplicationId, selectedId, selectApplication]);

  const loadApplicationHistory = useCallback(async (applicationId: string) => {
    if (!supabase) {
      setHistory([]);
      setHistoryError("Status history is unavailable.");
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
            "[recruiter-applications] history fetch failed",
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
          "[recruiter-applications] history network failure",
          historyLoadError,
        );
      }

      setHistory([]);
      setHistoryError("We could not load the status history.");
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const loadApplicationNotes = useCallback(async (applicationId: string) => {
    if (!supabase) {
      setNotes([]);
      setNotesError("Private notes are unavailable.");
      setIsNotesLoading(false);
      return;
    }

    setIsNotesLoading(true);
    setNotesError(null);

    try {
      const { data, error: notesFetchError } = await supabase.rpc(
        "get_recruiter_application_notes",
        { p_application_id: applicationId },
      );

      if (notesFetchError) {
        if (process.env.NODE_ENV === "development") {
          console.error(
            "[recruiter-applications] notes fetch failed",
            notesFetchError,
          );
        }

        setNotes([]);
        setNotesError("We could not load private notes.");
        return;
      }

      setNotes(
        mapRecruiterApplicationNotes(
          (data ?? []) as RecruiterApplicationNoteRow[],
        ),
      );
    } catch (notesLoadError) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[recruiter-applications] notes network failure",
          notesLoadError,
        );
      }

      setNotes([]);
      setNotesError("We could not load private notes.");
    } finally {
      setIsNotesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const loadId = window.setTimeout(() => {
      void loadApplicationHistory(selectedId);
      void loadApplicationNotes(selectedId);
    }, 0);

    return () => window.clearTimeout(loadId);
  }, [loadApplicationHistory, loadApplicationNotes, selectedId]);

  function resetFilters() {
    setDraftFilters(initialFilters);
    setFilters(initialFilters);
    setPage(1);
  }

  async function openResume(application: RecruiterApplication, download = false) {
    if (!supabase || !application.resumePath) {
      showErrorToast("Resume is not available for this application.");
      return;
    }

    const { data, error: resumeError } = await supabase.storage
      .from(applicationResumeBucket)
      .createSignedUrl(application.resumePath, 60, {
        download,
      });

    if (resumeError || !data?.signedUrl) {
      if (process.env.NODE_ENV === "development") {
        console.error("[recruiter-applications] resume URL failed", resumeError);
      }

      showErrorToast(
        "We could not open this resume. Please check storage policies.",
      );
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function openCandidateProfileResume(download = false) {
    if (!candidateProfile?.resume_path) {
      showErrorToast("Candidate profile resume is not available.");
      return;
    }

    const url = await getCandidateAssetUrl(candidateProfile.resume_path, download);

    if (!url) {
      showErrorToast("We could not open the candidate profile resume.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function updateStatus(
    application: RecruiterApplication,
    status: RecruiterApplicationStatus,
  ) {
    if (!supabase || isUpdating || application.status === status) {
      return;
    }

    const previousStatus = application.status;

    if (!getRecruiterApplicationNextStatuses(previousStatus).includes(status)) {
      showErrorToast("That status change is no longer available.");
      return;
    }

    setIsUpdating(true);
    setApplications((current) =>
      current.map((item) =>
        item.id === application.id ? { ...item, status } : item,
      ),
    );

    try {
      const { data, error: updateError } = await supabase.rpc(
        "transition_recruiter_application_status",
        {
          p_application_id: application.id,
          p_expected_status: previousStatus,
          p_new_status: status,
          p_note: null,
        },
      );

      const transition = (
        (data ?? []) as ApplicationStatusTransitionRow[]
      )[0];

      if (updateError || !transition?.history_id || !transition.history_created_at) {
        if (process.env.NODE_ENV === "development") {
          console.error(
            "[recruiter-applications] status update failed",
            updateError,
          );
        }

        throw updateError ?? new Error("Status update failed.");
      }

      const historyItem = mapApplicationStatusHistoryRow({
        application_id: application.id,
        changed_by_display: "You",
        changed_by_role: "recruiter",
        created_at: transition.history_created_at,
        id: transition.history_id,
        new_status: status,
        note: null,
        previous_status: previousStatus,
      });

      if (historyItem) {
        setHistory((current) => [
          historyItem,
          ...current.filter((item) => item.id !== historyItem.id),
        ]);
      }

      if (
        transition.notification_created === false &&
        process.env.NODE_ENV === "development"
      ) {
        console.warn(
          "[recruiter-applications] status changed without notification",
          { applicationId: application.id, status },
        );
      }

      showSuccessToast(
        `Application moved to ${getApplicationStatusDisplay(status).label}.`,
      );
      void loadApplications();
      void loadSummary();
    } catch (updateError) {
      setApplications((current) =>
        current.map((item) =>
          item.id === application.id
            ? { ...item, status: previousStatus }
          : item,
        ),
      );
      showErrorToast(getApplicationWorkflowErrorMessage(updateError));
      void loadApplications();
      void loadSummary();
      void loadApplicationHistory(application.id);
    } finally {
      setIsUpdating(false);
    }
  }

  function requestStatusUpdate(
    application: RecruiterApplication,
    status: RecruiterApplicationStatus,
  ) {
    if (status === "hired" || status === "rejected") {
      setPendingTransition({ application, status });
      return;
    }

    void updateStatus(application, status);
  }

  const closeStatusConfirmation = useCallback(() => {
    if (!isUpdating) {
      setPendingTransition(null);
    }
  }, [isUpdating]);

  async function confirmStatusUpdate() {
    if (!pendingTransition || isUpdating) {
      return;
    }

    await updateStatus(
      pendingTransition.application,
      pendingTransition.status,
    );
    setPendingTransition(null);
  }

  async function saveNote(application: RecruiterApplication) {
    if (!supabase || isUpdating) {
      return;
    }

    const noteText = notesDraft.trim();

    if (!noteText) {
      showErrorToast("Enter a note before saving.");
      return;
    }

    setIsUpdating(true);

    try {
      const { data, error: updateError } = editingNoteId
        ? await supabase.rpc("update_recruiter_application_note", {
            p_note_id: editingNoteId,
            p_note: noteText,
          })
        : await supabase.rpc("add_recruiter_application_note", {
            p_application_id: application.id,
            p_note: noteText,
          });

      if (updateError || !data || (Array.isArray(data) && data.length === 0)) {
        if (process.env.NODE_ENV === "development") {
          console.error(
            "[recruiter-applications] notes update failed",
            updateError,
          );
        }

        throw updateError ?? new Error("Notes update failed.");
      }

      setNotesDraft("");
      setEditingNoteId(null);
      await loadApplicationNotes(application.id);
      showSuccessToast(editingNoteId ? "Recruiter note updated." : "Recruiter note added.");
    } catch {
      showErrorToast("We could not save notes. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function deleteNote(application: RecruiterApplication, noteId: string) {
    if (!supabase || isUpdating) {
      return;
    }

    setIsUpdating(true);

    try {
      const { data, error: deleteError } = await supabase.rpc(
        "delete_recruiter_application_note",
        { p_note_id: noteId },
      );

      if (deleteError || data !== true) {
        if (process.env.NODE_ENV === "development") {
          console.error(
            "[recruiter-applications] note delete failed",
            deleteError,
          );
        }

        throw deleteError ?? new Error("Note delete failed.");
      }

      if (editingNoteId === noteId) {
        setEditingNoteId(null);
        setNotesDraft("");
      }
      await loadApplicationNotes(application.id);
      showSuccessToast("Recruiter note deleted.");
    } catch {
      showErrorToast("We could not delete this note. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function addTag(application: RecruiterApplication) {
    if (!supabase || !selectedTag || isUpdating) {
      return;
    }

    setIsUpdating(true);

    try {
      const { data, error: addError } = await supabase.rpc(
        "add_recruiter_application_tag",
        {
          p_application_id: application.id,
          p_tag: selectedTag,
        },
      );

      if (addError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[recruiter-applications] tag add failed", addError);
        }

        throw addError;
      }

      const tags = mapRecruiterApplicationTags(
        (data ?? []) as RecruiterApplicationTagRow[],
      );
      setApplications((current) =>
        current.map((item) =>
          item.id === application.id ? { ...item, tags } : item,
        ),
      );
      setSelectedTag("");
      showSuccessToast("Applicant tag added.");
    } catch {
      showErrorToast("We could not add this tag. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function removeTag(application: RecruiterApplication, tag: RecruiterApplicationTag) {
    if (!supabase || isUpdating) {
      return;
    }

    setIsUpdating(true);

    try {
      const { data, error: removeError } = await supabase.rpc(
        "remove_recruiter_application_tag",
        {
          p_application_id: application.id,
          p_tag: tag,
        },
      );

      if (removeError || data !== true) {
        if (process.env.NODE_ENV === "development") {
          console.error(
            "[recruiter-applications] tag remove failed",
            removeError,
          );
        }

        throw removeError ?? new Error("Tag remove failed.");
      }

      setApplications((current) =>
        current.map((item) =>
          item.id === application.id
            ? { ...item, tags: item.tags.filter((itemTag) => itemTag !== tag) }
            : item,
        ),
      );
      showSuccessToast("Applicant tag removed.");
    } catch {
      showErrorToast("We could not remove this tag. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <section className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
              Recruiter Applications
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Applicant Management
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-500">
              Review candidates who applied to your jobs, manage their status, and invite shortlisted applicants to interviews.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
            href="/jobs"
          >
            Manage Jobs
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Total Applicants", summary.totalApplicants],
            ["New", summary.newApplicants],
            ["Shortlisted", summary.shortlisted],
            ["Interviews Scheduled", summary.interviewsScheduled],
          ].map(([label, value]) => (
            <div
              className="rounded-xl border border-gray-200 bg-white px-4 py-3"
              key={String(label)}
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                {value}
              </p>
            </div>
          ))}
        </div>

        <form
          className="mt-6 rounded-xl border border-gray-200 bg-white p-4"
          onSubmit={applyFilters}
        >
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
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
                placeholder="Search name, email, skills or location"
                type="search"
                value={draftFilters.search}
              />
            </label>

            <SelectField
              label="Status"
              onChange={(status) =>
                setDraftFilters((current) => ({ ...current, status }))
              }
              value={draftFilters.status}
            >
              <option value="">All statuses</option>
              {applicationStatuses.map((status) => (
                <option key={status} value={status}>
                  {getApplicationStatusDisplay(status).label}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Job"
              onChange={(jobId) =>
                setDraftFilters((current) => ({ ...current, jobId }))
              }
              value={draftFilters.jobId}
            >
              <option value="">All jobs</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Sort"
              onChange={(sort) =>
                setDraftFilters((current) => ({
                  ...current,
                  sort: sort as RecruiterApplicationSort,
                }))
              }
              value={draftFilters.sort}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            {isAdvancedFiltersOpen ? (
              <label className="grid gap-2">
                <FieldLabel>Candidate location</FieldLabel>
                <input
                  className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      candidateLocation: event.target.value,
                    }))
                  }
                  placeholder="e.g. Bengaluru"
                  type="search"
                  value={draftFilters.candidateLocation}
                />
              </label>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              aria-expanded={isAdvancedFiltersOpen}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-colors hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
              onClick={() => setIsAdvancedFiltersOpen((current) => !current)}
              type="button"
            >
              {isAdvancedFiltersOpen ? "Hide filters" : "More filters"}
            </button>
            {!isAdvancedFiltersOpen ? (
              <div className="flex flex-wrap items-center gap-3">
                {hasActiveFilters ? (
                  <button
                    className="inline-flex h-10 items-center justify-center px-2 text-sm font-semibold text-gray-600 underline decoration-yellow-400 underline-offset-4 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                    onClick={resetFilters}
                    type="button"
                  >
                    Reset filters
                  </button>
                ) : null}
                <button
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                  type="submit"
                >
                  Apply
                </button>
              </div>
            ) : null}
          </div>

          {isAdvancedFiltersOpen ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-2">
              <FieldLabel>From</FieldLabel>
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
              <FieldLabel>To</FieldLabel>
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
            <SelectField
              label="Resume"
              onChange={(resumeAvailable) =>
                setDraftFilters((current) => ({ ...current, resumeAvailable }))
              }
              value={draftFilters.resumeAvailable}
            >
              <option value="">All applicants</option>
              <option value="yes">Resume available</option>
              <option value="no">No resume</option>
            </SelectField>
            <SelectField
              label="Tag"
              onChange={(tag) =>
                setDraftFilters((current) => ({ ...current, tag }))
              }
              value={draftFilters.tag}
            >
              <option value="">All tags</option>
              {recruiterApplicationTagValues.map((tag) => (
                <option key={tag} value={tag}>
                  {getRecruiterApplicationTagLabel(tag)}
                </option>
              ))}
            </SelectField>
            <div className="flex items-end gap-3">
              {hasActiveFilters ? (
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                  onClick={resetFilters}
                  type="button"
                >
                  Reset filters
                </button>
              ) : null}
              <button
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                type="submit"
              >
                Apply
              </button>
            </div>
          </div>
          ) : null}
        </form>

        {error ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
            <h2 className="text-lg font-bold text-gray-900">
              Applicants unavailable
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

        {!error && isLoading ? (
          <div className="mt-8 h-72 animate-pulse rounded-2xl border border-gray-200 bg-white shadow-[0_18px_45px_rgba(17,24,39,0.08)]" />
        ) : null}

        {!error && !isLoading && applications.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
            <h2 className="text-lg font-bold text-gray-900">
              {hasActiveFilters
                ? "No applicants match these filters"
                : "No applicants yet"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              {hasActiveFilters
                ? "Try changing your filters or clear them to see every applicant."
                : "Candidates who apply to your published jobs will appear here."}
            </p>
            {hasActiveFilters ? (
              <button
                className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                onClick={resetFilters}
                type="button"
              >
                Clear Filters
              </button>
            ) : (
              <Link
                className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                href="/jobs"
              >
                Manage Jobs
              </Link>
            )}
          </div>
        ) : null}

        {!error && !isLoading && applications.length > 0 ? (
          <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
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
                      <th className="px-5 py-4">Candidate</th>
                      <th className="px-5 py-4">Applied For</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Applied Date</th>
                      <th className="px-5 py-4">Resume</th>
                      <th className="px-5 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {applications.map((application) => (
                        <tr
                          className={`cursor-pointer transition-colors duration-200 hover:bg-yellow-50/50 ${
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
                          <td className="max-w-64 px-5 py-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <CandidateAvatar
                                imageUrl={application.candidateAvatarUrl}
                                name={application.candidateName}
                              />
                              <div className="min-w-0">
                                <p
                                  className="truncate font-bold text-gray-900"
                                  title={application.candidateName}
                                >
                                  {application.candidateName}
                                </p>
                                <p className="mt-1 truncate text-xs font-medium text-gray-500">
                                  {application.candidateEmail}
                                </p>
                                <p className="mt-1 truncate text-xs font-medium text-gray-500">
                                  {application.candidateLocation}
                                </p>
                                {application.tags.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {application.tags.map((tag) => (
                                      <span
                                        className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] font-bold text-yellow-900"
                                        key={tag}
                                      >
                                        {getRecruiterApplicationTagLabel(tag)}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="max-w-64 px-5 py-4">
                            <p className="break-words font-semibold text-gray-900">
                              {application.jobTitle}
                            </p>
                            <p className="mt-1 text-xs font-medium text-gray-500">
                              {application.companyName}
                            </p>
                            <p className="mt-1 text-xs font-medium text-gray-500">
                              {application.candidateExperience}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <ApplicationStatusBadge status={application.status} />
                          </td>
                          <td className="px-5 py-4 font-medium text-gray-500">
                            {formatDate(application.appliedAt)}
                          </td>
                          <td className="px-5 py-4 font-semibold text-gray-600">
                            {application.resumePath ? "View Resume" : "No Resume"}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              className="inline-flex h-9 items-center justify-center rounded-lg bg-black px-3 text-xs font-semibold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectApplication(application);
                              }}
                              type="button"
                            >
                              Review Applicant
                            </button>
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
                            imageUrl={application.candidateAvatarUrl}
                            name={application.candidateName}
                          />
                          <div className="min-w-0">
                            <p
                              className="truncate font-bold text-gray-900"
                              title={application.candidateName}
                            >
                              {application.candidateName}
                            </p>
                            <p
                              className="mt-1 line-clamp-2 break-words text-sm font-semibold text-gray-600"
                              title={application.jobTitle}
                            >
                              {application.jobTitle}
                            </p>
                            <p className="mt-2 text-xs font-medium text-gray-500">
                              {application.candidateLocation}
                            </p>
                          </div>
                        </div>
                        <ApplicationStatusBadge
                          compact
                          status={application.status}
                        />
                      </div>
                      <p className="mt-3 text-xs font-medium text-gray-500">
                        Applied {formatDate(application.appliedAt)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        {application.resumePath ? "Resume available" : "No Resume"}
                      </p>
                      <span className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-black px-3 text-xs font-semibold text-white">
                        Review Applicant
                      </span>
                      {application.tags.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {application.tags.map((tag) => (
                            <span
                              className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] font-bold text-yellow-900"
                              key={tag}
                            >
                              {getRecruiterApplicationTagLabel(tag)}
                            </span>
                          ))}
                        </div>
                      ) : null}
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
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={page >= totalPages}
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
                  <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
                    Review Applicant
                  </p>
                  <div className="flex items-start gap-3">
                    <CandidateAvatar
                      imageUrl={
                        candidateProfilePhotoUrl ??
                        selectedApplication.candidateAvatarUrl
                      }
                      name={selectedApplication.candidateName}
                      size="md"
                    />
                    <div className="min-w-0">
                      <h2
                        className="break-words text-lg font-bold tracking-tight text-gray-900"
                        title={selectedApplication.candidateName}
                      >
                        {selectedApplication.candidateName}
                      </h2>
                      <p className="mt-1 break-all text-xs font-medium text-gray-500">
                        {selectedApplication.candidateEmail}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 text-sm">
                    <p className="font-semibold text-gray-900">
                      {selectedApplication.jobTitle}
                    </p>
                    <p className="text-gray-500">
                      Applied {formatDate(selectedApplication.appliedAt)}
                    </p>
                  </div>

                  {candidateProfile ? (
                    <section className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          Candidate profile
                        </h3>
                        <span className="text-xs font-semibold text-gray-500">
                          {candidateProfile.profile_completion}% complete
                        </span>
                      </div>
                      {candidateProfile.professional_headline ? (
                        <p className="mt-2 break-words text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {candidateProfile.professional_headline}
                        </p>
                      ) : null}
                      {candidateProfile.location ? (
                        <p className="mt-1 text-xs font-medium text-gray-500">
                          {candidateProfile.location}
                        </p>
                      ) : null}
                      {candidateProfile.about_me ? (
                        <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-gray-600 dark:text-gray-300">
                          {candidateProfile.about_me}
                        </p>
                      ) : null}
                      {candidateProfile.experience ? (
                        <div className="mt-3">
                          <FieldLabel>Experience</FieldLabel>
                          <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-gray-600 dark:text-gray-300">
                            {candidateProfile.experience}
                          </p>
                        </div>
                      ) : null}
                      {candidateProfile.education ? (
                        <div className="mt-3">
                          <FieldLabel>Education</FieldLabel>
                          <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-gray-600 dark:text-gray-300">
                            {candidateProfile.education}
                          </p>
                        </div>
                      ) : null}
                      {candidateProfile.skills.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {candidateProfile.skills.map((skill) => (
                            <span
                              className="rounded-full border border-yellow-300 bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-gray-800 dark:bg-yellow-400/10 dark:text-gray-100"
                              key={skill}
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {candidateProfile.resume_path ? (
                        <button
                          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 hover:bg-yellow-50 focus:outline-none focus:ring-4 focus:ring-yellow-100 dark:border-white/15 dark:bg-white/5 dark:text-gray-100"
                          onClick={() => void openCandidateProfileResume()}
                          type="button"
                        >
                          View Profile Resume
                        </button>
                      ) : null}
                      {(candidateProfile.portfolio_url ||
                        candidateProfile.linkedin_url ||
                        candidateProfile.github_url) ? (
                        <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
                          {candidateProfile.portfolio_url ? (
                            <a
                              className="text-gray-700 underline decoration-yellow-400 underline-offset-4 hover:text-gray-900"
                              href={candidateProfile.portfolio_url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Portfolio
                            </a>
                          ) : null}
                          {candidateProfile.linkedin_url ? (
                            <a
                              className="text-gray-700 underline decoration-yellow-400 underline-offset-4 hover:text-gray-900"
                              href={candidateProfile.linkedin_url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              LinkedIn
                            </a>
                          ) : null}
                          {candidateProfile.github_url ? (
                            <a
                              className="text-gray-700 underline decoration-yellow-400 underline-offset-4 hover:text-gray-900"
                              href={candidateProfile.github_url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              GitHub
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  <section className="mt-5 grid gap-3">
                    <FieldLabel>Status</FieldLabel>
                    <div className="flex flex-wrap items-center gap-3">
                      <ApplicationStatusBadge
                        status={selectedApplication.status}
                      />
                      {getRecruiterApplicationNextStatuses(
                        selectedApplication.status,
                      ).includes("reviewing") ||
                      getRecruiterApplicationNextStatuses(
                        selectedApplication.status,
                      ).includes("shortlisted") ? (
                        <div className="flex flex-wrap gap-2">
                          {getRecruiterApplicationNextStatuses(
                            selectedApplication.status,
                          ).includes("reviewing") ? (
                            <button
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-900 transition-colors hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:opacity-50"
                              disabled={isUpdating}
                              onClick={() =>
                                void updateStatus(selectedApplication, "reviewing")
                              }
                              type="button"
                            >
                              Mark as Reviewed
                            </button>
                          ) : null}
                          {getRecruiterApplicationNextStatuses(
                            selectedApplication.status,
                          ).includes("shortlisted") ? (
                            <button
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-yellow-300 bg-yellow-50 px-3 text-xs font-semibold text-gray-900 transition-colors hover:bg-yellow-100 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:opacity-50"
                              disabled={isUpdating}
                              onClick={() =>
                                void updateStatus(selectedApplication, "shortlisted")
                              }
                              type="button"
                            >
                              Shortlist
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {getRecruiterApplicationNextStatuses(
                        selectedApplication.status,
                      ).length > 0 ? (
                        <label className="min-w-0 flex-1">
                          <span className="sr-only">
                            Move application to the next status
                          </span>
                          <select
                            aria-label="Move application to the next status"
                            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition-colors duration-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                            disabled={isUpdating}
                            onChange={(event) => {
                              if (event.target.value) {
                                requestStatusUpdate(
                                  selectedApplication,
                                  event.target.value as RecruiterApplicationStatus,
                                );
                              }
                            }}
                            value=""
                          >
                            <option value="">Move to...</option>
                            {getRecruiterApplicationNextStatuses(
                              selectedApplication.status,
                            ).map((status) => (
                              <option key={status} value={status}>
                                {getApplicationStatusDisplay(status).label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p className="text-xs font-medium leading-5 text-gray-500">
                          No further recruiter actions are available.
                        </p>
                      )}
                      {getRecruiterApplicationNextStatuses(
                        selectedApplication.status,
                      ).includes("interview") ? (
                        <button
                          className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isUpdating}
                          onClick={() => setIsScheduleInterviewOpen(true)}
                          type="button"
                        >
                          Invite to Interview
                        </button>
                      ) : null}
                    </div>
                  </section>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <button
                      aria-label={`View resume for ${selectedApplication.candidateName}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!selectedApplication.resumePath}
                      onClick={() => void openResume(selectedApplication)}
                      type="button"
                    >
                      View Resume
                    </button>
                    <button
                      aria-label={`Download resume for ${selectedApplication.candidateName}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      disabled={!selectedApplication.resumePath}
                      onClick={() => void openResume(selectedApplication, true)}
                      type="button"
                    >
                      Download
                    </button>
                  </div>
                  {!selectedApplication.resumePath ? (
                    <p className="mt-2 text-xs font-medium text-gray-500">
                      Resume unavailable for this application.
                    </p>
                  ) : null}

                  <section className="mt-6">
                    <h3 className="text-sm font-bold text-gray-900">
                      Cover Letter
                    </h3>
                    <p className="mt-2 whitespace-pre-line rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                      {selectedApplication.coverLetter ||
                        "No cover letter provided."}
                    </p>
                  </section>

                  <section className="mt-6">
                    <h3 className="text-sm font-bold text-gray-900">
                      Application Answers
                    </h3>
                    {getAnswerEntries(selectedApplication.answers).length > 0 ? (
                      <div className="mt-2 grid gap-3">
                        {getAnswerEntries(selectedApplication.answers).map(
                          ([key, value]) => (
                            <div
                              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                              key={key}
                            >
                              <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
                                {key}
                              </p>
                              <p className="mt-2 break-words text-sm leading-6 text-gray-700">
                                {renderAnswerValue(value)}
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                        No additional answers.
                      </p>
                    )}
                  </section>

                  <section className="mt-6">
                    <h3 className="text-sm font-bold text-gray-900">
                      Status History
                    </h3>
                    <div className="mt-3">
                      <ApplicationStatusTimeline
                        error={historyError}
                        history={history}
                        loading={isHistoryLoading || isNotesLoading}
                        notes={notes}
                      />
                    </div>
                  </section>

                  <section className="mt-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-gray-900">
                        Private recruiter notes
                      </h3>
                      <span className="text-xs font-medium text-gray-500">
                        {notes.length} note{notes.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3">
                      {isNotesLoading ? (
                        <div
                          aria-busy="true"
                          className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-50"
                        />
                      ) : notesError ? (
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <p className="text-sm leading-6 text-gray-500">
                            {notesError}
                          </p>
                          <button
                            className="mt-3 text-sm font-bold text-gray-900 underline decoration-yellow-400 underline-offset-4 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                            onClick={() => void loadApplicationNotes(selectedApplication.id)}
                            type="button"
                          >
                            Retry
                          </button>
                        </div>
                      ) : notes.length > 0 ? (
                        notes.map((note) => (
                          <article
                            className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                            key={note.id}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <time
                                className="text-xs font-semibold text-gray-500"
                                dateTime={note.updatedAt}
                              >
                                {formatDate(note.updatedAt)}
                              </time>
                              <div className="flex gap-3 text-xs font-bold">
                                <button
                                  className="text-gray-700 underline decoration-yellow-400 underline-offset-4 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                                  disabled={isUpdating}
                                  onClick={() => {
                                    setEditingNoteId(note.id);
                                    setNotesDraft(note.note);
                                  }}
                                  type="button"
                                >
                                  Edit
                                </button>
                                <button
                                  className="text-red-700 underline decoration-red-300 underline-offset-4 focus:outline-none focus:ring-4 focus:ring-red-200"
                                  disabled={isUpdating}
                                  onClick={() => void deleteNote(selectedApplication, note.id)}
                                  type="button"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-gray-700">
                              {note.note}
                            </p>
                          </article>
                        ))
                      ) : (
                        <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-500">
                          No private notes yet.
                        </p>
                      )}
                    </div>
                    <label className="mt-4 grid gap-2">
                      <FieldLabel>
                        {editingNoteId ? "Edit note" : "Add note"}
                      </FieldLabel>
                      <textarea
                        aria-label="Private recruiter note"
                        className="min-h-28 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium leading-6 text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                        disabled={isUpdating}
                        maxLength={12000}
                        onChange={(event) => setNotesDraft(event.target.value)}
                        placeholder="Private notes visible only to your recruiter account"
                        value={notesDraft}
                      />
                    </label>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isUpdating || !notesDraft.trim()}
                        onClick={() => void saveNote(selectedApplication)}
                        type="button"
                      >
                        {isUpdating
                          ? "Saving..."
                          : editingNoteId
                            ? "Update Note"
                            : "Add Note"}
                      </button>
                      {editingNoteId ? (
                        <button
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                          disabled={isUpdating}
                          onClick={() => {
                            setEditingNoteId(null);
                            setNotesDraft("");
                          }}
                          type="button"
                        >
                          Cancel edit
                        </button>
                      ) : null}
                    </div>
                  </section>

                  <section className="mt-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-gray-900">
                        Applicant tags
                      </h3>
                      <span className="text-xs font-medium text-gray-500">
                        Private
                      </span>
                    </div>
                    {selectedApplication.tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedApplication.tags.map((tag) => (
                          <span
                            className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-bold text-yellow-900"
                            key={tag}
                          >
                            {getRecruiterApplicationTagLabel(tag)}
                            <button
                              aria-label={`Remove ${getRecruiterApplicationTagLabel(tag)} tag`}
                              className="rounded-full px-1 text-yellow-900 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                              disabled={isUpdating}
                              onClick={() => void removeTag(selectedApplication, tag)}
                              type="button"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-gray-500">
                        No tags added yet.
                      </p>
                    )}
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <label className="min-w-0 flex-1">
                        <span className="sr-only">Select an applicant tag</span>
                        <select
                          aria-label="Select an applicant tag"
                          className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                          disabled={isUpdating}
                          onChange={(event) =>
                            setSelectedTag(
                              isRecruiterApplicationTag(event.target.value)
                                ? event.target.value
                                : "",
                            )
                          }
                          value={selectedTag}
                        >
                          <option value="">Add a tag...</option>
                          {recruiterApplicationTagValues
                            .filter((tag) => !selectedApplication.tags.includes(tag))
                            .map((tag) => (
                              <option key={tag} value={tag}>
                                {getRecruiterApplicationTagLabel(tag)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-yellow-200"
                        disabled={isUpdating || !selectedTag}
                        onClick={() => void addTag(selectedApplication)}
                        type="button"
                      >
                        Add Tag
                      </button>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
                  <h2 className="text-base font-bold text-gray-900">
                    Select an applicant
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Click an applicant to review profile details, resume, cover
                    letter, answers, status, and private notes.
                  </p>
                </div>
              )}
            </aside>
          </div>
        ) : null}
      </section>

      {pendingTransition ? (
        <ApplicationConfirmationDialog
          confirmLabel={
            pendingTransition.status === "hired"
              ? "Mark as Hired"
              : "Reject Application"
          }
          description={`${pendingTransition.application.candidateName}'s application for ${pendingTransition.application.jobTitle} will move to ${getApplicationStatusDisplay(pendingTransition.status).label}. This action cannot be reversed through the hiring pipeline.`}
          isBusy={isUpdating}
          onCancel={closeStatusConfirmation}
          onConfirm={() => void confirmStatusUpdate()}
          title={
            pendingTransition.status === "hired"
              ? "Mark as Hired?"
              : "Reject Application?"
          }
        />
      ) : null}
      {isScheduleInterviewOpen && selectedApplication ? (
        <InterviewScheduleDialog
          applications={[
            {
              applicationId: selectedApplication.id,
              applicationStatus: selectedApplication.status,
              candidateName: selectedApplication.candidateName,
              jobId: selectedApplication.jobId,
              jobTitle: selectedApplication.jobTitle,
            } satisfies InterviewApplicationOption,
          ]}
          initialApplicationId={selectedApplication.id}
          onClose={() => setIsScheduleInterviewOpen(false)}
          onSaved={() => {
            setIsScheduleInterviewOpen(false);
            void loadApplications();
            void loadSummary();
            void loadApplicationHistory(selectedApplication.id);
          }}
        />
      ) : null}
    </main>
  );
}
