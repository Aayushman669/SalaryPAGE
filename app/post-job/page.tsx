"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import AuthLoading from "../auth-loading";
import { useAuth } from "../auth-context";
import JobPreview from "./job-preview";
import {
  ensureProfile,
  getProfile,
  type ProfileRow,
  updateProfileRole,
} from "@/lib/auth-profiles";
import {
  formatEmploymentType,
  formatExperienceLevel,
  formatWorkplaceType,
  isEmploymentType,
  isExperienceLevel,
  isWorkplaceType,
} from "@/lib/jobs";
import { enqueueClientEmailEvent } from "@/lib/email/client";
import { canPostJob, getSubscriptionSnapshot } from "@/lib/subscriptions";
import {
  buildJobSubmitPayload,
  buildJobPreviewData,
  initialJobForm,
  jobCurrencyOptions,
  jobEmploymentOptions,
  jobExperienceOptions,
  jobFieldLabels,
  jobWorkplaceOptions,
  type JobDraft,
  type JobForm,
  type JobFormField,
  type JobSubmitMode,
  type JobValidationErrors,
  type JobValidationField,
  validateJobForm,
} from "@/lib/job-form";
import { saveJobSubmission } from "@/lib/job-submissions";
import { getCompanyProfile, type CompanyProfile } from "@/lib/company-profile";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type AccessState = "checking" | "allowed" | "denied" | "error" | "unpaid" | "restricted";
type AutoSaveState = "idle" | "saving" | "saved" | "failed";

const inputClassName =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:bg-gray-50 aria-invalid:border-red-300 aria-invalid:focus:ring-red-100";
const selectClassName =
  "h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-900 outline-none transition-all duration-200 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:bg-gray-50 aria-invalid:border-red-300 aria-invalid:focus:ring-red-100";
const textareaClassName =
  "min-h-40 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium leading-7 text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:bg-gray-50 aria-invalid:border-red-300 aria-invalid:focus:ring-red-100";

function getDraftStorageKey(userId: string) {
  return `job-board:post-job:draft:${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readLocalDraft(storageKey: string): JobDraft | null {
  try {
    const rawDraft = window.localStorage.getItem(storageKey);

    if (!rawDraft) {
      return null;
    }

    const parsedDraft = JSON.parse(rawDraft);

    if (!isRecord(parsedDraft) || !isRecord(parsedDraft.form)) {
      return null;
    }

    return {
      form: {
        ...initialJobForm,
        ...(parsedDraft.form as Partial<JobForm>),
      },
      id: typeof parsedDraft.id === "string" ? parsedDraft.id : null,
      savedAt:
        typeof parsedDraft.savedAt === "string" ? parsedDraft.savedAt : null,
    };
  } catch {
    return null;
  }
}

function writeLocalDraft(storageKey: string, draft: JobDraft) {
  window.localStorage.setItem(storageKey, JSON.stringify(draft));
}

function clearLocalDraft(storageKey: string | null) {
  if (storageKey) {
    window.localStorage.removeItem(storageKey);
  }
}

type EditableJobRow = {
  application_email: string | null;
  application_url: string | null;
  benefits: string;
  category: string;
  company_name: string;
  description: string;
  employment_type: string;
  experience_level: string | null;
  location: string;
  publish_at: string | null;
  requirements: string;
  salary_currency: string;
  salary_max: number | string | null;
  salary_min: number | string | null;
  salary_visible: boolean;
  title: string;
  workplace_type: string;
};

function toLocalDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function toFormNumber(value: number | string | null) {
  return value === null || value === "" ? "" : String(value);
}

function buildJobFormFromRow(row: EditableJobRow): JobForm {
  return {
    ...initialJobForm,
    applicationEmail: row.application_email ?? "",
    applicationUrl: row.application_url ?? "",
    benefits: row.benefits ?? "",
    category: row.category ?? "",
    city: row.location ?? "",
    companyName: row.company_name ?? "",
    description: row.description ?? "",
    employmentType: isEmploymentType(row.employment_type)
      ? row.employment_type
      : initialJobForm.employmentType,
    experienceLevel: isExperienceLevel(row.experience_level)
      ? row.experience_level
      : "",
    publishAt: toLocalDateTimeInput(row.publish_at),
    remote: row.workplace_type === "remote",
    requirements: row.requirements ?? "",
    salaryCurrency: row.salary_currency ?? initialJobForm.salaryCurrency,
    salaryMax: toFormNumber(row.salary_max),
    salaryMin: toFormNumber(row.salary_min),
    salaryVisible: row.salary_visible !== false,
    workplaceType: isWorkplaceType(row.workplace_type)
      ? row.workplace_type
      : initialJobForm.workplaceType,
  };
}

function getFullNameFromUserMetadata(metadata: Record<string, unknown>) {
  return typeof metadata.full_name === "string" ? metadata.full_name : "";
}

function getAutoSaveLabel({
  hasUnsavedChanges,
  lastSavedAt,
  state,
}: {
  hasUnsavedChanges: boolean;
  lastSavedAt: string | null;
  state: AutoSaveState;
}) {
  if (state === "saving") {
    return "Saving...";
  }

  if (state === "failed") {
    return "Save failed";
  }

  if (state === "saved" || lastSavedAt) {
    return hasUnsavedChanges ? "Unsaved changes" : "Saved just now";
  }

  return hasUnsavedChanges ? "Unsaved changes" : "Ready to save";
}

function getFirstError(errors: JobValidationErrors) {
  const firstField = Object.keys(errors)[0] as JobValidationField | undefined;

  return firstField ? errors[firstField] : null;
}

const invalidFieldFocusOrder: JobValidationField[] = [
  "title",
  "companyName",
  "category",
  "employmentType",
  "workplaceType",
  "country",
  "state",
  "city",
  "remote",
  "salaryVisible",
  "salaryCurrency",
  "salary",
  "salaryMin",
  "salaryMax",
  "experienceLevel",
  "description",
  "requirements",
  "benefits",
  "applicationMethod",
  "applicationEmail",
  "applicationUrl",
  "publishAt",
];

function getFocusableFieldForError(field: JobValidationField) {
  if (field === "applicationMethod") {
    return "applicationEmail";
  }

  if (field === "salary") {
    return "salaryMin";
  }

  return field;
}

function getFirstInvalidField(errors: JobValidationErrors) {
  return invalidFieldFocusOrder.find((field) => Boolean(errors[field]));
}

function focusInvalidField(errors: JobValidationErrors) {
  const invalidField = getFirstInvalidField(errors);

  if (!invalidField) {
    return;
  }

  const focusField = getFocusableFieldForError(invalidField);

  window.setTimeout(() => {
    const focusTarget = document.querySelector<HTMLElement>(
      `[data-job-field="${focusField}"]`,
    );

    focusTarget?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    focusTarget?.focus({
      preventScroll: true,
    });
  }, 80);
}

function Section({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(17,24,39,0.06)] sm:p-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-gray-900">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
      </div>
      <div className="mt-6 grid gap-5">{children}</div>
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  return (
    <span className="min-h-5 text-sm font-medium text-red-600">
      {message}
    </span>
  );
}

export default function PostJobPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthLoading, isLoggedIn } = useAuth();
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [accessError, setAccessError] = useState("");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [form, setForm] = useState<JobForm>(initialJobForm);
  const [formErrors, setFormErrors] = useState<JobValidationErrors>({});
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("idle");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const formRef = useRef(form);
  const activeJobIdRef = useRef(activeJobId);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  const isPreviewOpenRef = useRef(isPreviewOpen);
  const isSavingRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const editJobId = searchParams.get("edit");

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    activeJobIdRef.current = activeJobId;
  }, [activeJobId]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    isPreviewOpenRef.current = isPreviewOpen;
  }, [isPreviewOpen]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }

    let isMounted = true;

    async function loadAccess() {
      setAccessState("checking");
      setAccessError("");

      if (!supabase) {
        if (isMounted) {
          setAccessError(
            "Supabase is not configured. Please check your environment variables.",
          );
          setAccessState("error");
        }

        return;
      }

      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        if (process.env.NODE_ENV === "development" && error) {
          console.error("[post-job] current user lookup failed", error);
        }

        router.replace("/login");
        return;
      }

      const userId = data.user.id;
      const nextStorageKey = getDraftStorageKey(userId);
      const profileResponse = await getProfile(userId);
      const nextProfile = profileResponse.profile;

      if (profileResponse.error) {
        if (isMounted) {
          setAccessError(profileResponse.error);
          setAccessState("error");
        }

        return;
      }

      if (!nextProfile) {
        const profileError = await ensureProfile({
          email: data.user.email ?? "",
          fullName: getFullNameFromUserMetadata(data.user.user_metadata),
          userId,
        });

        if (profileError) {
          if (isMounted) {
            setAccessError(profileError);
            setAccessState("error");
          }

          return;
        }

        router.replace("/onboarding");
        return;
      }

      if (nextProfile.profile_completed !== true || !nextProfile.role_mode) {
        router.replace("/onboarding");
        return;
      }

      if (!isMounted) {
        return;
      }

      setCurrentUserId(userId);
      setProfile(nextProfile);

      if (nextProfile.moderation_status === "restricted") {
        setAccessError("Your recruiter account is temporarily restricted from posting new jobs.");
        setAccessState("restricted");
        return;
      }

      if (nextProfile.role_mode !== "recruiter") {
        setAccessState("denied");
        return;
      }

      const companyResult = await getCompanyProfile(userId);

      if (companyResult.company) {
        setCompany(companyResult.company);
      }

      const subscriptionResult = await getSubscriptionSnapshot();

      if (subscriptionResult.error || !subscriptionResult.snapshot) {
        if (isMounted) {
          setAccessError(
            subscriptionResult.error ??
              "We could not verify your posting access. Please try again.",
          );
          setAccessState("error");
        }

        return;
      }

      if (!canPostJob(subscriptionResult.snapshot).allowed) {
        setAccessState("unpaid");
        return;
      }

      setStorageKey(nextStorageKey);

      if (editJobId) {
        const { data: editJob, error: editJobError } = await supabase
          .from("jobs")
          .select(
            "application_email, application_url, benefits, category, company_name, description, employment_type, experience_level, location, publish_at, requirements, salary_currency, salary_max, salary_min, salary_visible, title, workplace_type",
          )
          .eq("id", editJobId)
          .eq("created_by", userId)
          .maybeSingle();

        if (editJobError || !editJob) {
          if (isMounted) {
            setAccessError("We could not find that job in your recruiter account.");
            setAccessState("error");
          }

          return;
        }

        setForm(buildJobFormFromRow(editJob as EditableJobRow));
        setActiveJobId(editJobId);
        setLastSavedAt(new Date().toISOString());
        setHasUnsavedChanges(false);
        setAutoSaveState("saved");
        setAccessState("allowed");
        return;
      }

      const localDraft = readLocalDraft(nextStorageKey);

      if (localDraft) {
        setForm(localDraft.form);
        setActiveJobId(localDraft.id);
        setLastSavedAt(localDraft.savedAt);
        setHasUnsavedChanges(false);
        setAutoSaveState(localDraft.savedAt ? "saved" : "idle");
      } else if (companyResult.company) {
        setForm((currentForm) => ({
          ...currentForm,
          companyName: companyResult.company?.name ?? currentForm.companyName,
        }));
      }

      setAccessState("allowed");
    }

    void loadAccess();

    return () => {
      isMounted = false;
    };
  }, [editJobId, isAuthLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!storageKey || !hasUnsavedChanges) {
      return;
    }

    writeLocalDraft(storageKey, {
      form,
      id: activeJobId,
      savedAt: lastSavedAt,
    });
  }, [activeJobId, form, hasUnsavedChanges, lastSavedAt, storageKey]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChangesRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const saveDraft = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (
        !currentUserId ||
        isSavingRef.current ||
        isSubmittingRef.current ||
        accessState !== "allowed"
      ) {
        return false;
      }

      const draftForm = formRef.current;
      const validation = validateJobForm(draftForm, "draft");

      if (!validation.valid) {
        setFormErrors(validation.errors);
        setAutoSaveState("failed");

        if (!silent) {
          showErrorToast(
            "Draft could not be saved.",
            getFirstError(validation.errors) ?? "Review highlighted fields.",
          );
        }

        return false;
      }

      const savedFormSnapshot = JSON.stringify(draftForm);
      const payload = buildJobSubmitPayload({
        companyId: company?.id,
        form: draftForm,
        recruiterId: currentUserId,
        status: "draft",
      });

      isSavingRef.current = true;
      setIsSavingDraft(true);
      setAutoSaveState("saving");

      const result = await saveJobSubmission({
        jobId: activeJobIdRef.current,
        payload,
      });

      isSavingRef.current = false;
      setIsSavingDraft(false);

      if (result.error) {
        setAutoSaveState("failed");

        if (!silent) {
          showErrorToast("Draft could not be saved.", result.error);
        }

        return false;
      }

      const nextJobId = result.job?.id ?? activeJobIdRef.current;
      const nextSavedAt = result.job?.updated_at ?? new Date().toISOString();

      setActiveJobId(nextJobId);
      setLastSavedAt(nextSavedAt);
      setAutoSaveState("saved");

      if (JSON.stringify(formRef.current) === savedFormSnapshot) {
        setHasUnsavedChanges(false);
      }

      if (storageKey) {
        writeLocalDraft(storageKey, {
          form: formRef.current,
          id: nextJobId,
          savedAt: nextSavedAt,
        });
      }

      if (!silent) {
        showSuccessToast("Draft saved successfully.");
      }

      return true;
    },
    [accessState, company?.id, currentUserId, storageKey],
  );

  useEffect(() => {
    if (accessState !== "allowed" || !currentUserId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (
        hasUnsavedChangesRef.current &&
        !isPreviewOpenRef.current &&
        !isSavingRef.current &&
        !isSubmittingRef.current
      ) {
        void saveDraft({ silent: true });
      }
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [accessState, currentUserId, saveDraft]);

  function clearFieldErrors(field: JobValidationField) {
    setFormErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];

      if (field === "salaryMin" || field === "salaryMax") {
        delete nextErrors.salary;
      }

      if (field === "applicationEmail" || field === "applicationUrl") {
        delete nextErrors.applicationMethod;
      }

      if (field === "city" || field === "state" || field === "country") {
        delete nextErrors.city;
      }

      return nextErrors;
    });
  }

  function updateField(field: JobFormField, value: JobForm[JobFormField]) {
    setForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [field]: value,
      };

      if (field === "remote" && value === true) {
        nextForm.workplaceType = "remote";
      }

      if (
        field === "workplaceType" &&
        (value === "remote" || value === "hybrid" || value === "on_site")
      ) {
        nextForm.remote = value === "remote";
      }

      return nextForm;
    });
    clearFieldErrors(field);
    setAutoSaveState((currentState) =>
      currentState === "failed" ? "idle" : currentState,
    );
    setHasUnsavedChanges(true);
  }

  function validateAndSetErrors(mode: JobSubmitMode) {
    const validation = validateJobForm(formRef.current, mode);
    setFormErrors(validation.errors);

    if (!validation.valid) {
      if (mode === "published") {
        setIsPreviewOpen(false);
        focusInvalidField(validation.errors);
      }

      showErrorToast(
        mode === "published"
          ? "Job is not ready to publish."
          : "Draft could not be saved.",
        getFirstError(validation.errors) ?? "Review highlighted fields.",
      );
    }

    return validation.valid;
  }

  async function publishJob() {
    if (!currentUserId || isSubmittingRef.current || isSavingRef.current) {
      return;
    }

    if (!validateAndSetErrors("published")) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const result = await saveJobSubmission({
      jobId: activeJobId,
      payload: buildJobSubmitPayload({
        companyId: company?.id,
        form: formRef.current,
        recruiterId: currentUserId,
        status: "published",
      }),
    });

    isSubmittingRef.current = false;
    setIsSubmitting(false);

    if (result.error) {
      showErrorToast("Job could not be published.", result.error);
      return;
    }

    const submittedJobId = result.job?.id ?? activeJobId;

    if (submittedJobId) {
      void enqueueClientEmailEvent({
        jobId: submittedJobId,
        type: formRef.current.publishAt.trim()
          ? "job_scheduled"
          : "job_published",
      });
    }

    setHasUnsavedChanges(false);
    clearLocalDraft(storageKey);
    showSuccessToast(
      formRef.current.publishAt.trim()
        ? "Your job has been scheduled."
        : "Your job is now live.",
    );
    router.push("/dashboard");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void publishJob();
  }

  function handleOpenPreview() {
    if (accessState !== "allowed") {
      return;
    }

    setIsPreviewOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSwitchToRecruiter() {
    if (!currentUserId || isSwitchingRole) {
      return;
    }

    setIsSwitchingRole(true);
    const result = await updateProfileRole({
      role: "recruiter",
      userId: currentUserId,
    });
    setIsSwitchingRole(false);

    if (result.error || !result.profile) {
      showErrorToast(
        "Role could not be switched.",
        result.error ?? "Please try again.",
      );
      return;
    }

    setProfile(result.profile);
    setAccessState("allowed");
    showSuccessToast("Switched to Recruiter");
  }

  function renderInput({
    autoComplete,
    field,
    placeholder,
    type = "text",
  }: {
    autoComplete?: string;
    field: JobFormField;
    placeholder: string;
    type?: string;
  }) {
    return (
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-gray-900">
          {jobFieldLabels[field]}
        </span>
        <input
          autoComplete={autoComplete}
          value={String(form[field] ?? "")}
          onChange={(event) => updateField(field, event.target.value)}
          aria-invalid={Boolean(formErrors[field])}
          className={inputClassName}
          data-job-field={field}
          placeholder={placeholder}
          type={type}
        />
        <FieldError message={formErrors[field]} />
      </label>
    );
  }

  function renderTextarea({
    field,
    placeholder,
    rows,
  }: {
    field: Extract<JobFormField, "benefits" | "description" | "requirements">;
    placeholder: string;
    rows?: number;
  }) {
    return (
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-gray-900">
          {jobFieldLabels[field]}
        </span>
        <textarea
          value={form[field]}
          onChange={(event) => updateField(field, event.target.value)}
          aria-invalid={Boolean(formErrors[field])}
          className={textareaClassName}
          data-job-field={field}
          placeholder={placeholder}
          rows={rows}
        />
        <FieldError message={formErrors[field]} />
      </label>
    );
  }

  if (isAuthLoading || accessState === "checking") {
    return <AuthLoading />;
  }

  if (accessState === "error") {
    return (
      <main className="ui-consistency-surface min-h-screen bg-background px-6 py-12 text-foreground sm:px-8 sm:py-16 lg:px-12">
        <section className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center">
          <div className="w-full rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(17,24,39,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
              Post Job
            </p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
              We could not load posting access.
            </h1>
            <p className="mt-4 text-sm leading-6 text-gray-500">
              {accessError || "Please refresh and try again."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
            >
              Try Again
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (accessState === "denied") {
    return (
      <main className="ui-consistency-surface min-h-screen bg-background px-6 py-12 text-foreground sm:px-8 sm:py-16 lg:px-12">
        <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
          <div className="w-full rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(17,24,39,0.08)] sm:p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-50 text-sm font-black text-gray-900 ring-1 ring-yellow-200">
              R
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900">
              Recruiter access required
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-gray-500">
              Posting jobs is available only for Recruiter accounts.
            </p>
            {profile?.role_mode ? (
              <p className="mt-3 text-sm text-gray-500">
                Your current role is{" "}
                <span className="font-semibold text-gray-900">
                  Job Seeker
                </span>
                .
              </p>
            ) : null}
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleSwitchToRecruiter}
                disabled={isSwitchingRole}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none"
              >
                {isSwitchingRole ? "Switching..." : "Switch Role"}
              </button>
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:-translate-y-0.5 hover:bg-yellow-50/60 hover:shadow-[0_12px_28px_rgba(17,24,39,0.08)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (accessState === "restricted") {
    return (
      <main className="ui-consistency-surface mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-5 py-12">
        <section className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-7 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Posting access</p>
          <h1 className="mt-3 text-2xl font-bold">Job posting is temporarily restricted.</h1>
          <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">{accessError}</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] focus:outline-none focus:ring-4 focus:ring-yellow-300">Go to Dashboard</Link>
        </section>
      </main>
    );
  }

  if (accessState === "unpaid") {
    return (
      <main className="ui-consistency-surface min-h-screen bg-background px-6 py-12 text-foreground sm:px-8 sm:py-16 lg:px-12">
        <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
          <div className="w-full rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(17,24,39,0.08)] sm:p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-50 text-sm font-black text-gray-900 ring-1 ring-yellow-200">
              P
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900">
              Choose a plan to post jobs
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-gray-500">
              Posting jobs is available after you activate a paid recruiter
              plan.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/pricing"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
              >
                View Pricing
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:-translate-y-0.5 hover:bg-yellow-50/60 hover:shadow-[0_12px_28px_rgba(17,24,39,0.08)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const autoSaveLabel = getAutoSaveLabel({
    hasUnsavedChanges,
    lastSavedAt,
    state: autoSaveState,
  });

  if (isPreviewOpen) {
    return (
      <JobPreview
        autoSaveLabel={autoSaveLabel}
        data={buildJobPreviewData(form)}
        hasUnsavedChanges={hasUnsavedChanges}
        isSavingDraft={isSavingDraft}
        isSubmitting={isSubmitting}
        onBackToEdit={() => setIsPreviewOpen(false)}
        onSaveDraft={() => void saveDraft()}
        onSubmit={() => void publishJob()}
      />
    );
  }

  return (
    <main className="ui-consistency-surface min-h-screen bg-background px-6 py-12 text-foreground sm:px-8 sm:py-16 lg:px-12">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
              Hiring workflow
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Post a Job
            </h1>
            <p className="mt-5 text-lg leading-8 text-gray-500">
              Create a job as a draft, then publish it when every detail is
              ready.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-[0_14px_40px_rgba(17,24,39,0.06)]">
            <p className="font-semibold text-gray-900">
              {profile?.full_name?.trim() || "Recruiter"}
            </p>
            <p className="mt-1 text-gray-500">Recruiter account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-10 grid gap-6">
          <Section
            title="Basic Information"
            description="Set the role identity candidates will see first."
          >
            <div className="grid gap-5 md:grid-cols-2">
              {renderInput({
                autoComplete: "organization-title",
                field: "title",
                placeholder: "Senior Frontend Engineer",
              })}
              {renderInput({
                autoComplete: "organization",
                field: "companyName",
                placeholder: "Acme Labs",
              })}
              {renderInput({
                field: "category",
                placeholder: "Engineering",
              })}
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  Employment Type
                </span>
                <select
                  value={form.employmentType}
                  onChange={(event) =>
                    updateField("employmentType", event.target.value)
                  }
                  className={selectClassName}
                  data-job-field="employmentType"
                  aria-invalid={Boolean(formErrors.employmentType)}
                >
                  {jobEmploymentOptions.map((employmentType) => (
                    <option key={employmentType} value={employmentType}>
                      {formatEmploymentType(employmentType)}
                    </option>
                  ))}
                </select>
                <FieldError message={formErrors.employmentType} />
              </label>
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-semibold text-gray-900">
                  Workplace Type
                </span>
                <select
                  value={form.workplaceType}
                  onChange={(event) =>
                    updateField("workplaceType", event.target.value)
                  }
                  className={selectClassName}
                  data-job-field="workplaceType"
                  aria-invalid={Boolean(formErrors.workplaceType)}
                >
                  {jobWorkplaceOptions.map((workplaceType) => (
                    <option key={workplaceType} value={workplaceType}>
                      {formatWorkplaceType(workplaceType)}
                    </option>
                  ))}
                </select>
                <FieldError message={formErrors.workplaceType} />
              </label>
            </div>
          </Section>

          <Section
            title="Location"
            description="Use structured location fields now, with a clean display label saved to the job."
          >
            <div className="grid gap-5 md:grid-cols-3">
              {renderInput({
                autoComplete: "country-name",
                field: "country",
                placeholder: "United States",
              })}
              {renderInput({
                autoComplete: "address-level1",
                field: "state",
                placeholder: "California",
              })}
              {renderInput({
                autoComplete: "address-level2",
                field: "city",
                placeholder: "San Francisco",
              })}
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <input
                checked={form.remote}
                onChange={(event) => updateField("remote", event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-300"
                data-job-field="remote"
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">
                  Remote option
                </span>
                <span className="mt-1 block text-sm leading-6 text-gray-500">
                  Mark this if the role can be done remotely.
                </span>
              </span>
            </label>
            <FieldError message={formErrors.city} />
          </Section>

          <Section
            title="Salary"
            description="Add a transparent range or keep salary hidden while saving the internal range."
          >
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <input
                checked={form.salaryVisible}
                onChange={(event) =>
                  updateField("salaryVisible", event.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-300"
                data-job-field="salaryVisible"
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">
                  Salary visibility
                </span>
                <span className="mt-1 block text-sm leading-6 text-gray-500">
                  Show salary range publicly when this job is published.
                </span>
              </span>
            </label>
            <div className="grid gap-5 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  Currency
                </span>
                <select
                  value={form.salaryCurrency}
                  onChange={(event) =>
                    updateField("salaryCurrency", event.target.value)
                  }
                  className={selectClassName}
                  data-job-field="salaryCurrency"
                  aria-invalid={Boolean(formErrors.salaryCurrency)}
                >
                  {jobCurrencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
                <FieldError message={formErrors.salaryCurrency} />
              </label>
              {renderInput({
                field: "salaryMin",
                placeholder: "80000",
                type: "number",
              })}
              {renderInput({
                field: "salaryMax",
                placeholder: "120000",
                type: "number",
              })}
            </div>
            <FieldError message={formErrors.salary} />
          </Section>

          <Section
            title="Experience"
            description="Choose the level that best matches the expectations for this role."
          >
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-900">
                Experience Level
              </span>
              <select
                value={form.experienceLevel}
                onChange={(event) =>
                  updateField("experienceLevel", event.target.value)
                }
                className={selectClassName}
                data-job-field="experienceLevel"
                aria-invalid={Boolean(formErrors.experienceLevel)}
              >
                <option value="">Not specified</option>
                {jobExperienceOptions.map((experienceLevel) => (
                  <option key={experienceLevel} value={experienceLevel}>
                    {formatExperienceLevel(experienceLevel)}
                  </option>
                ))}
              </select>
              <FieldError message={formErrors.experienceLevel} />
            </label>
          </Section>

          <Section
            title="Job Description"
            description="Write the role overview, responsibilities, and what success looks like."
          >
            {renderTextarea({
              field: "description",
              placeholder:
                "Describe the role, responsibilities, team context, and what makes this opportunity worth applying for.",
              rows: 10,
            })}
          </Section>

          <Section
            title="Requirements"
            description="List must-have skills, experience, and expectations."
          >
            {renderTextarea({
              field: "requirements",
              placeholder:
                "Example: 3+ years with React, strong TypeScript fundamentals, experience shipping production interfaces.",
              rows: 8,
            })}
          </Section>

          <Section
            title="Benefits"
            description="Add perks, compensation context, and support that help candidates decide."
          >
            {renderTextarea({
              field: "benefits",
              placeholder:
                "Example: Flexible work, learning budget, health benefits, generous PTO, and a focused product culture.",
              rows: 8,
            })}
          </Section>

          <Section
            title="Application"
            description="Choose where candidates should apply once the job is published."
          >
            <div className="grid gap-5 md:grid-cols-2">
              {renderInput({
                autoComplete: "email",
                field: "applicationEmail",
                placeholder: "hiring@company.com",
                type: "email",
              })}
              {renderInput({
                field: "applicationUrl",
                placeholder: "https://company.com/careers/role",
                type: "url",
              })}
            </div>
            <FieldError message={formErrors.applicationMethod} />
          </Section>

          <Section
            title="Publishing"
            description="Schedule when the job becomes public, or leave it empty for immediate visibility."
          >
            {renderInput({
              field: "publishAt",
              placeholder: "Select a future date and time",
              type: "datetime-local",
            })}
            <p className="-mt-4 text-xs leading-5 text-gray-500">
              This uses your browser timezone and saves the schedule in UTC.
            </p>
          </Section>

          <div className="sticky bottom-4 z-10 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-[0_22px_70px_rgba(17,24,39,0.14)] backdrop-blur">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {autoSaveLabel}
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Drafts auto-save every 30 seconds while you work.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void saveDraft()}
                  disabled={isSavingDraft || isSubmitting}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:-translate-y-0.5 hover:bg-yellow-50/60 hover:shadow-[0_12px_28px_rgba(17,24,39,0.08)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
                >
                  {isSavingDraft ? "Saving..." : "Save Draft"}
                </button>
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  disabled={isSubmitting}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:-translate-y-0.5 hover:bg-yellow-50/60 hover:shadow-[0_12px_28px_rgba(17,24,39,0.08)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
                >
                  Preview
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isSavingDraft}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none"
                >
                  {isSubmitting ? "Publishing..." : "Publish Job"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
