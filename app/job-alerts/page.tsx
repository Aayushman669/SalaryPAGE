"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useAuth } from "@/app/auth-context";
import { getProfile, type ProfileRow } from "@/lib/auth-profiles";
import {
  emptyJobAlertForm,
  formatJobAlertSummary,
  jobAlertEmploymentTypes,
  jobAlertExperienceLevels,
  jobAlertToForm,
  jobAlertWorkplaceTypes,
  loadCandidateJobAlerts,
  saveCandidateJobAlert,
  setCandidateJobAlertEnabled,
  deleteCandidateJobAlert,
  validateJobAlertForm,
  type JobAlert,
  type JobAlertForm,
  type JobAlertsResult,
} from "@/lib/job-alerts";
import {
  formatEmploymentType,
  formatExperienceLevel,
  formatWorkplaceType,
} from "@/lib/jobs";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";

function formatDate(value: string | null) {
  if (!value) {
    return "Date not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function JobAlertsLoading() {
  return (
    <main className="ui-consistency-surface min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <section className="mx-auto w-full max-w-6xl" aria-busy="true">
        <div className="animate-pulse">
          <div className="h-4 w-32 rounded-full bg-skeleton" />
          <div className="mt-5 h-12 w-80 max-w-full rounded-2xl bg-skeleton" />
          <div className="mt-4 h-5 w-full max-w-2xl rounded-full bg-skeleton" />
          <div className="mt-10 h-56 rounded-2xl border border-border bg-card" />
        </div>
      </section>
    </main>
  );
}

function JobAlertsAccessDenied({ recruiter = false }: { recruiter?: boolean }) {
  return (
    <main className="ui-consistency-surface flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Job Alerts
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-card-foreground">
          {recruiter ? "Job Alerts are for Job Seekers" : "Job Alerts unavailable"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {recruiter
            ? "Switch to a Job Seeker account to manage alerts for your search."
            : "Complete onboarding before managing job alerts."}
        </p>
        <Link
          className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          href="/dashboard"
        >
          Go to Dashboard
        </Link>
      </section>
    </main>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs font-semibold text-red-600 dark:text-red-400" role="alert">
      {message}
    </p>
  ) : null;
}

function AlertEditor({
  errors,
  form,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
}: {
  errors: Partial<Record<keyof JobAlertForm, string>>;
  form: JobAlertForm;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (nextForm: JobAlertForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className="rounded-2xl border border-border bg-card p-5 shadow-[0_18px_50px_rgba(17,24,39,0.08)] sm:p-6"
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {form.id ? "Edit alert" : "New alert"}
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-card-foreground">
            Choose what you want to hear about
          </h2>
        </div>
        <button
          className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-semibold text-card-foreground transition-colors hover:border-accent focus:outline-none focus:ring-4 focus:ring-yellow-200"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>

      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Alert name
          </span>
          <input
            aria-describedby="job-alert-name-error"
            aria-invalid={errors.alertName ? "true" : undefined}
            className="h-11 rounded-xl border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-yellow-100"
            maxLength={120}
            onChange={(event) => onChange({ ...form, alertName: event.target.value })}
            placeholder="Senior frontend roles"
            required
            value={form.alertName}
          />
          <span id="job-alert-name-error"><FieldError message={errors.alertName} /></span>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Keywords
          </span>
          <input
            aria-describedby="job-alert-keywords-error"
            aria-invalid={errors.keywordsText ? "true" : undefined}
            className="h-11 rounded-xl border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent focus:ring-4 focus:ring-yellow-100"
            onChange={(event) => onChange({ ...form, keywordsText: event.target.value })}
            placeholder="React, TypeScript, frontend"
            value={form.keywordsText}
          />
          <span id="job-alert-keywords-error"><FieldError message={errors.keywordsText} /></span>
          <p className="text-xs text-muted-foreground">Separate keywords with commas.</p>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Location
          </span>
          <input
            aria-describedby="job-alert-location-error"
            aria-invalid={errors.location ? "true" : undefined}
            className="h-11 rounded-xl border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent focus:ring-4 focus:ring-yellow-100"
            maxLength={160}
            onChange={(event) => onChange({ ...form, location: event.target.value })}
            placeholder="Delhi, Remote, New York"
            value={form.location}
          />
          <FieldError message={errors.location} />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Minimum salary
          </span>
          <input
            aria-describedby="job-alert-salary-error"
            aria-invalid={errors.salaryMin ? "true" : undefined}
            className="h-11 rounded-xl border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent focus:ring-4 focus:ring-yellow-100"
            inputMode="decimal"
            min="0"
            onChange={(event) => onChange({ ...form, salaryMin: event.target.value })}
            placeholder="Optional"
            type="number"
            value={form.salaryMin}
          />
          <FieldError message={errors.salaryMin} />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Employment type
          </span>
          <select
            aria-describedby="job-alert-employment-error"
            aria-invalid={errors.employmentType ? "true" : undefined}
            className="h-11 rounded-xl border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-yellow-100"
            onChange={(event) => onChange({ ...form, employmentType: event.target.value })}
            value={form.employmentType}
          >
            <option value="">Any employment type</option>
            {jobAlertEmploymentTypes.map((value) => (
              <option key={value} value={value}>{formatEmploymentType(value)}</option>
            ))}
          </select>
          <FieldError message={errors.employmentType} />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Work model
          </span>
          <select
            aria-describedby="job-alert-work-model-error"
            aria-invalid={errors.workModel ? "true" : undefined}
            className="h-11 rounded-xl border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-yellow-100"
            onChange={(event) => onChange({ ...form, workModel: event.target.value })}
            value={form.workModel}
          >
            <option value="">Any work model</option>
            {jobAlertWorkplaceTypes.map((value) => (
              <option key={value} value={value}>{formatWorkplaceType(value)}</option>
            ))}
          </select>
          <FieldError message={errors.workModel} />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Experience level
          </span>
          <select
            aria-describedby="job-alert-experience-error"
            aria-invalid={errors.experienceLevel ? "true" : undefined}
            className="h-11 rounded-xl border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-yellow-100"
            onChange={(event) => onChange({ ...form, experienceLevel: event.target.value })}
            value={form.experienceLevel}
          >
            <option value="">Any experience level</option>
            {jobAlertExperienceLevels.map((value) => (
              <option key={value} value={value}>{formatExperienceLevel(value)}</option>
            ))}
          </select>
          <FieldError message={errors.experienceLevel} />
        </label>

        <label className="flex items-center gap-3 self-end rounded-xl border border-border bg-muted px-4 py-3 text-sm font-semibold text-card-foreground">
          <input
            checked={form.enabled}
            className="h-4 w-4 rounded border-border text-yellow-500 focus:ring-yellow-300"
            onChange={(event) => onChange({ ...form, enabled: event.target.checked })}
            type="checkbox"
          />
          Keep this alert enabled
        </label>
      </div>

      <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <button
          className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold text-card-foreground transition-colors hover:border-accent focus:outline-none focus:ring-4 focus:ring-yellow-200"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving..." : form.id ? "Save Changes" : "Create Alert"}
        </button>
      </div>
    </form>
  );
}

function AlertCard({
  alert,
  isPending,
  onDelete,
  onEdit,
  onToggle,
}: {
  alert: JobAlert;
  isPending: boolean;
  onDelete: (alert: JobAlert) => void;
  onEdit: (alert: JobAlert) => void;
  onToggle: (alert: JobAlert) => void;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-[0_18px_45px_rgba(17,24,39,0.06)] sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${
              alert.enabled
                ? "border-yellow-300 bg-yellow-50 text-gray-900"
                : "border-border bg-muted text-muted-foreground"
            }`}>
              {alert.enabled ? "Enabled" : "Paused"}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Updated {formatDate(alert.updatedAt ?? alert.createdAt)}
            </span>
          </div>
          <h2 className="mt-3 break-words text-xl font-bold tracking-tight text-card-foreground">
            {alert.alertName}
          </h2>
          <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
            {formatJobAlertSummary(alert)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <button
            aria-label={`${alert.enabled ? "Disable" : "Enable"} ${alert.alertName}`}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground transition-colors hover:border-accent focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            onClick={() => onToggle(alert)}
            type="button"
          >
            {isPending ? "Saving..." : alert.enabled ? "Disable" : "Enable"}
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground transition-colors hover:border-accent focus:outline-none focus:ring-4 focus:ring-yellow-200"
            onClick={() => onEdit(alert)}
            type="button"
          >
            Edit
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-card px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-200 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-400/10"
            onClick={() => onDelete(alert)}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function JobAlertsEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted p-8 text-center">
      <h2 className="text-lg font-bold text-card-foreground">No job alerts yet</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Create an alert to keep your search preferences ready for future matching.
      </p>
      <button
        className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200"
        onClick={onCreate}
        type="button"
      >
        Create Alert
      </button>
    </div>
  );
}

export default function JobAlertsPage() {
  const router = useRouter();
  const { isAuthLoading, isLoggedIn } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [result, setResult] = useState<JobAlertsResult>({
    alerts: [],
    enabledCount: 0,
    error: null,
    page: 1,
    pageCount: 1,
    totalCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [editorForm, setEditorForm] = useState<JobAlertForm | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof JobAlertForm, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isLoggedIn || !supabase) {
      router.replace(`/login?next=${encodeURIComponent("/job-alerts")}`);
      return;
    }

    let isMounted = true;

    async function loadProfile() {
      setIsProfileLoading(true);
      const { data, error } = await supabase!.auth.getUser();

      if (error || !data.user) {
        if (isMounted) {
          setIsProfileLoading(false);
          router.replace(`/login?next=${encodeURIComponent("/job-alerts")}`);
        }
        return;
      }

      const profileResult = await getProfile(data.user.id);

      if (isMounted) {
        setProfile(profileResult.profile);
        setIsProfileLoading(false);
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, isLoggedIn, router]);

  const loadAlerts = useCallback(async () => {
    if (profile?.role_mode !== "job_seeker") {
      return;
    }

    const nextRequestId = requestId.current + 1;
    requestId.current = nextRequestId;
    setIsLoading(true);
    setResult((current) => ({ ...current, error: null }));

    const nextResult = await loadCandidateJobAlerts(page);

    if (requestId.current !== nextRequestId) {
      return;
    }

    if (page > nextResult.pageCount) {
      setPage(nextResult.pageCount);
      return;
    }

    setResult(nextResult);
    setIsLoading(false);
  }, [page, profile?.role_mode]);

  useEffect(() => {
    if (profile?.role_mode === "job_seeker") {
      const loadId = window.setTimeout(() => {
        void loadAlerts();
      }, 0);

      return () => window.clearTimeout(loadId);
    }

    return undefined;
  }, [loadAlerts, profile?.role_mode]);

  useEffect(() => {
    if (profile && profile.profile_completed !== true) {
      router.replace("/onboarding");
    }
  }, [profile, router]);

  function startCreate() {
    setFormErrors({});
    setEditorForm({ ...emptyJobAlertForm });
  }

  function handleEdit(alert: JobAlert) {
    setFormErrors({});
    setEditorForm(jobAlertToForm(alert));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editorForm || isSaving) {
      return;
    }

    const validation = validateJobAlertForm(editorForm);

    if (!validation.valid) {
      setFormErrors(validation.errors);
      showErrorToast(Object.values(validation.errors)[0] ?? "Review the alert fields.");
      return;
    }

    setFormErrors({});
    setIsSaving(true);
    const response = await saveCandidateJobAlert(editorForm);
    setIsSaving(false);

    if (response.error || !response.alert) {
      showErrorToast(response.error ?? "We could not save this alert.");
      return;
    }

    setEditorForm(null);
    showSuccessToast(editorForm.id ? "Job alert updated." : "Job alert created.");
    void loadAlerts();
  }

  async function handleToggle(alert: JobAlert) {
    if (pendingId) {
      return;
    }

    const previousResult = result;
    const nextEnabled = !alert.enabled;
    setPendingId(alert.id);
    setResult((current) => ({
      ...current,
      alerts: current.alerts.map((item) =>
        item.id === alert.id ? { ...item, enabled: nextEnabled } : item,
      ),
      enabledCount: current.enabledCount + (nextEnabled ? 1 : -1),
    }));

    const response = await setCandidateJobAlertEnabled(alert.id, nextEnabled);
    setPendingId(null);

    if (response.error) {
      setResult(previousResult);
      showErrorToast(response.error);
      return;
    }

    showSuccessToast(nextEnabled ? "Job alert enabled." : "Job alert disabled.");
  }

  async function handleDelete(alert: JobAlert) {
    if (pendingId || !window.confirm(`Delete the "${alert.alertName}" job alert?`)) {
      return;
    }

    setPendingId(alert.id);
    const response = await deleteCandidateJobAlert(alert.id);
    setPendingId(null);

    if (response.error) {
      showErrorToast(response.error);
      return;
    }

    showSuccessToast("Job alert deleted.");
    void loadAlerts();
  }

  if (isAuthLoading || isProfileLoading) {
    return <JobAlertsLoading />;
  }

  if (!isLoggedIn) {
    return <JobAlertsLoading />;
  }

  if (profile?.role_mode !== "job_seeker") {
    return <JobAlertsAccessDenied recruiter={profile?.role_mode === "recruiter"} />;
  }

  return (
    <main className="ui-consistency-surface min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <section className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Job Seeker Dashboard
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Job Alerts
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
              Keep your search preferences ready for future job matching. Delivery will be added separately.
            </p>
          </div>
          <button
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-yellow-200"
            onClick={startCreate}
            type="button"
          >
            Create Alert
          </button>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_18px_45px_rgba(17,24,39,0.06)]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Total alerts</p>
            <p className="mt-3 text-3xl font-bold text-card-foreground">{result.totalCount}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_18px_45px_rgba(17,24,39,0.06)]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Enabled alerts</p>
            <p className="mt-3 text-3xl font-bold text-card-foreground">{result.enabledCount}</p>
          </div>
        </div>

        {editorForm ? (
          <div className="mt-8">
            <AlertEditor
              errors={formErrors}
              form={editorForm}
              isSaving={isSaving}
              onCancel={() => setEditorForm(null)}
              onChange={(nextForm) => {
                setEditorForm(nextForm);
                setFormErrors({});
              }}
              onSubmit={handleSave}
            />
          </div>
        ) : null}

        {result.error ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.06)]">
            <h2 className="text-lg font-bold text-card-foreground">Job Alerts unavailable</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{result.error}</p>
            <button
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200"
              onClick={() => void loadAlerts()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        {isLoading && !result.error ? (
          <div className="mt-8 grid gap-4" aria-live="polite">
            {[0, 1].map((item) => (
              <div aria-hidden="true" className="h-40 animate-pulse rounded-2xl border border-border bg-skeleton" key={item} />
            ))}
          </div>
        ) : null}

        {!isLoading && !result.error && result.alerts.length === 0 ? (
          <div className="mt-8">
            <JobAlertsEmpty onCreate={startCreate} />
          </div>
        ) : null}

        {!result.error && result.alerts.length > 0 ? (
          <div className="mt-8 grid gap-4">
            {result.alerts.map((alert) => (
              <AlertCard
                alert={alert}
                isPending={pendingId === alert.id}
                key={alert.id}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onToggle={handleToggle}
              />
            ))}
          </div>
        ) : null}

        {!result.error && !isLoading && result.pageCount > 1 ? (
          <nav aria-label="Job alerts pagination" className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-4 sm:flex-row">
            <p className="text-sm font-medium text-muted-foreground">
              Page {page} of {result.pageCount} / {result.totalCount} alerts
            </p>
            <div className="flex gap-3">
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Previous
              </button>
              <button
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page >= result.pageCount || isLoading}
                onClick={() => setPage((current) => Math.min(result.pageCount, current + 1))}
                type="button"
              >
                Next
              </button>
            </div>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
