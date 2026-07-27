"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import type { DashboardProfile } from "@/lib/dashboard-data";
import type { SettingsSectionId } from "@/lib/settings";
import { isValidEmail } from "@/lib/auth-errors";
import { validateCandidatePassword } from "@/lib/candidate-settings";
import { normalizeDashboardProfile } from "@/lib/dashboard-data";
import { updateRecruiterProfile } from "@/lib/auth-profiles";
import { notifyDashboardProfileChanged } from "../dashboard/use-dashboard-data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../auth-context";
import {
  createRecruiterProfileForm,
  defaultRecruiterNotificationPreferences,
  deleteRecruiterAvatar,
  getRecruiterDeletionRequest,
  getRecruiterAvatarUrl,
  getRecruiterNotificationPreferences,
  requestRecruiterAccountDeletion,
  uploadRecruiterAvatar,
  validateRecruiterProfile,
  updateRecruiterNotificationPreferences,
  type RecruiterDeletionRequest,
  type RecruiterNotificationPreferences,
  type RecruiterProfileForm,
  type RecruiterProfileValidationErrors,
} from "@/lib/recruiter-settings";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import CompanySettingsPanel from "./company-settings-panel";

const inputClassName =
  "h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-medium text-card-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent focus:ring-4 focus:ring-yellow-200";
const textareaClassName =
  "min-h-28 w-full resize-y rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium leading-6 text-card-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent focus:ring-4 focus:ring-yellow-200";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-xs font-medium text-destructive" role="alert">
      {message}
    </p>
  ) : null;
}

function FieldLabel({ children, htmlFor }: { children: string; htmlFor: string }) {
  return (
    <label className="text-sm font-semibold text-card-foreground" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function PreferenceToggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-card-foreground focus-within:ring-4 focus-within:ring-yellow-200">
      <input
        aria-label={label}
        checked={checked}
        className="h-4 w-4 rounded border-border text-accent focus:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}

function PreferenceRow({
  children,
  description,
  label,
}: {
  children: ReactNode;
  description: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-card-foreground">{label}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">{children}</div>
      </div>
    </div>
  );
}

function formatAccountDate(value: string | null | undefined, includeTime = false) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

export function RecruiterProfileSettingsPanel({
  profile,
}: {
  profile: DashboardProfile;
}) {
  const [form, setForm] = useState<RecruiterProfileForm>(
    createRecruiterProfileForm(profile),
  );
  const [errors, setErrors] = useState<RecruiterProfileValidationErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;

    if (!form.recruiterAvatarPath) {
      return () => {
        active = false;
      };
    }

    void getRecruiterAvatarUrl(form.recruiterAvatarPath).then((url) => {
      if (!active) return;
      setAvatarUrl(url);
    });

    return () => {
      active = false;
    };
  }, [form.recruiterAvatarPath]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function updateField<K extends keyof RecruiterProfileForm>(
    field: K,
    value: RecruiterProfileForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setErrorMessage("");
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size <= 0 ||
      file.size > 5 * 1024 * 1024
    ) {
      setErrors((current) => ({
        ...current,
        avatar: "Profile photo must be a JPG, PNG, or WebP image smaller than 5MB.",
      }));
      return;
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setErrors((current) => ({ ...current, avatar: undefined }));
  }

  function removeAvatar() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarUrl(null);
    updateField("recruiterAvatarPath", null);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const validation = validateRecruiterProfile(form);
    setErrors(validation.errors);
    if (!validation.valid) {
      showErrorToast("Profile needs attention.", "Review the highlighted fields.");
      return;
    }

    setIsSaving(true);
    const previousAvatarPath = form.recruiterAvatarPath;
    let nextAvatarPath = form.recruiterAvatarPath;

    if (avatarFile) {
      const uploadResult = await uploadRecruiterAvatar(avatarFile, profile.id);
      if (uploadResult.error || !uploadResult.path) {
        setIsSaving(false);
        setErrors({ avatar: uploadResult.error ?? "Profile photo upload failed." });
        showErrorToast(uploadResult.error ?? "Profile photo upload failed.");
        return;
      }
      nextAvatarPath = uploadResult.path;
    }

    const result = await updateRecruiterProfile({
      profile: {
        bio: form.bio,
        department: form.department,
        fullName: form.fullName,
        jobTitle: form.jobTitle,
        linkedinUrl: form.linkedinUrl,
        location: form.location,
        phone: form.phone,
        recruiterAvatarPath: nextAvatarPath,
      },
    });

    if (result.error || !result.profile) {
      if (nextAvatarPath && nextAvatarPath !== previousAvatarPath) {
        await deleteRecruiterAvatar(nextAvatarPath);
      }
      setIsSaving(false);
      setErrorMessage(result.error ?? "We could not save your recruiter profile.");
      showErrorToast(result.error ?? "We could not save your recruiter profile.");
      return;
    }

    if (previousAvatarPath && previousAvatarPath !== nextAvatarPath) {
      await deleteRecruiterAvatar(previousAvatarPath);
    }

    const nextForm = createRecruiterProfileForm(result.profile);
    setForm(nextForm);
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setErrorMessage("");
    setIsSaving(false);

    const normalizedProfile = normalizeDashboardProfile(result.profile);
    if (normalizedProfile) {
      notifyDashboardProfileChanged(normalizedProfile);
    }

    showSuccessToast("Recruiter profile saved successfully.");
  }

  const visibleAvatar = avatarPreview ?? avatarUrl;

  return (
    <div className="grid gap-5">
      <form className="grid gap-5" onSubmit={saveProfile}>
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-card-foreground">Personal profile</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Keep your recruiter identity current across the hiring workspace.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-lg font-black text-muted-foreground">
              {visibleAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Recruiter profile" className="h-full w-full object-cover" decoding="async" loading="lazy" src={visibleAvatar} />
              ) : (
                (form.fullName.trim().slice(0, 1) || "R").toUpperCase()
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-semibold text-card-foreground transition-colors hover:border-accent focus-within:ring-4 focus-within:ring-yellow-200">
                Choose photo
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={isSaving}
                  onChange={handleAvatarChange}
                  type="file"
                />
              </label>
              {form.recruiterAvatarPath || avatarFile ? (
                <button
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-3 text-sm font-semibold text-card-foreground transition-colors hover:border-red-300 hover:text-destructive focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:opacity-60"
                  disabled={isSaving}
                  onClick={removeAvatar}
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {errors.avatar ? <FieldError message={errors.avatar} /> : null}
        {errorMessage ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-300/20 dark:bg-red-300/10 dark:text-red-200" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <FieldLabel htmlFor="recruiter-full-name">Full name</FieldLabel>
            <input autoComplete="name" className={inputClassName} id="recruiter-full-name" maxLength={120} onChange={(event) => updateField("fullName", event.target.value)} value={form.fullName} />
            <FieldError message={errors.fullName} />
          </div>
          <div className="grid gap-2">
            <FieldLabel htmlFor="recruiter-job-title">Job title</FieldLabel>
            <input autoComplete="organization-title" className={inputClassName} id="recruiter-job-title" maxLength={160} onChange={(event) => updateField("jobTitle", event.target.value)} placeholder="e.g. Talent Acquisition Lead" value={form.jobTitle} />
            <FieldError message={errors.jobTitle} />
          </div>
          <div className="grid gap-2">
            <FieldLabel htmlFor="recruiter-department">Department</FieldLabel>
            <input className={inputClassName} id="recruiter-department" maxLength={160} onChange={(event) => updateField("department", event.target.value)} placeholder="e.g. People Operations" value={form.department} />
            <FieldError message={errors.department} />
          </div>
          <div className="grid gap-2">
            <FieldLabel htmlFor="recruiter-phone">Phone number</FieldLabel>
            <input autoComplete="tel" className={inputClassName} id="recruiter-phone" maxLength={40} onChange={(event) => updateField("phone", event.target.value)} value={form.phone} />
            <FieldError message={errors.phone} />
          </div>
          <div className="grid gap-2">
            <FieldLabel htmlFor="recruiter-location">Location</FieldLabel>
            <input autoComplete="address-level2" className={inputClassName} id="recruiter-location" maxLength={160} onChange={(event) => updateField("location", event.target.value)} value={form.location} />
            <FieldError message={errors.location} />
          </div>
          <div className="grid gap-2">
            <FieldLabel htmlFor="recruiter-linkedin">LinkedIn URL</FieldLabel>
            <input autoComplete="url" className={inputClassName} id="recruiter-linkedin" inputMode="url" maxLength={500} onChange={(event) => updateField("linkedinUrl", event.target.value)} placeholder="https://www.linkedin.com/in/..." value={form.linkedinUrl} />
            <FieldError message={errors.linkedinUrl} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <FieldLabel htmlFor="recruiter-bio">Short bio</FieldLabel>
            <textarea className={textareaClassName} id="recruiter-bio" maxLength={4000} onChange={(event) => updateField("bio", event.target.value)} placeholder="A short introduction candidates can understand." value={form.bio} />
            <FieldError message={errors.bio} />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
          <button className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">
            {isSaving ? "Saving profile..." : "Save profile"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-muted p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-card-foreground">Company profile</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Company branding and public company details remain managed here.
            </p>
          </div>
          <Link className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200" href="#company-profile-editor">
            Jump to company details
          </Link>
        </div>
      </div>

      <div id="company-profile-editor">
        <CompanySettingsPanel profile={profile} />
      </div>
    </div>
  );
}

export function RecruiterAccountSettingsPanel({
  profile,
}: {
  profile: DashboardProfile;
}) {
  const [email, setEmail] = useState(profile.email ?? "");
  const [isVerified, setIsVerified] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? profile.email ?? "");
      setIsVerified(Boolean(data.user?.email_confirmed_at));
      setCreatedAt(data.user?.created_at ?? null);
    });
  }, [profile.email]);

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!isValidEmail(nextEmail)) {
      showErrorToast("Enter a valid email address.");
      return;
    }
    if (nextEmail === (profile.email ?? "").trim()) {
      showErrorToast("Enter a different email address to update it.");
      return;
    }
    if (!supabase) {
      showErrorToast("Authentication is not configured.");
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({ email: nextEmail });
    setIsSaving(false);

    if (error) {
      showErrorToast("We could not start the email change. Please try again.");
      return;
    }

    showSuccessToast("Check your new email to confirm the change.");
  }

  return (
    <div className="grid gap-5">
      <form className="grid gap-4 rounded-xl border border-border bg-muted p-5" onSubmit={updateEmail}>
        <div>
          <h3 className="text-base font-bold text-card-foreground">Account email</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Email changes use Supabase Auth confirmation. Your current session remains protected.</p>
        </div>
        <div className="grid gap-2">
          <FieldLabel htmlFor="recruiter-email">Sign-in email</FieldLabel>
          <input autoComplete="email" className={inputClassName} id="recruiter-email" inputMode="email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Current status: {isVerified ? "Verified" : "Verification required"}.</p>
          <button className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Sending confirmation..." : "Change email"}</button>
        </div>
      </form>
      <div className="rounded-xl border border-border bg-muted p-5">
        <h3 className="text-base font-bold text-card-foreground">Account record</h3>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Account created</dt><dd className="mt-1 font-semibold text-card-foreground">{formatAccountDate(createdAt)}</dd></div>
          <div><dt className="text-muted-foreground">Role</dt><dd className="mt-1 font-semibold text-card-foreground">Recruiter</dd></div>
        </dl>
      </div>
    </div>
  );
}

export function RecruiterSecuritySettingsPanel({
  profile,
}: {
  profile: DashboardProfile;
}) {
  const { logout } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setLastSignIn(data.user?.last_sign_in_at ?? null);
      setIsVerified(Boolean(data.user?.email_confirmed_at));
    });
  }, []);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const passwordError = validateCandidatePassword(password, confirmation);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (!supabase) {
      setError("Authentication is not configured.");
      return;
    }

    setError("");
    setIsSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSaving(false);
    if (updateError) {
      setError("We could not update your password. Your session may have expired.");
      return;
    }

    setPassword("");
    setConfirmation("");
    showSuccessToast("Password updated successfully.");
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-border bg-muted p-5">
        <h3 className="text-base font-bold text-card-foreground">Security information</h3>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Sign-in email</dt><dd className="mt-1 break-all font-semibold text-card-foreground">{profile.email || "Email unavailable"}</dd></div>
          <div><dt className="text-muted-foreground">Email verification</dt><dd className="mt-1 font-semibold text-card-foreground">{isVerified ? "Verified" : "Not verified"}</dd></div>
          <div><dt className="text-muted-foreground">Last sign-in</dt><dd className="mt-1 font-semibold text-card-foreground">{formatAccountDate(lastSignIn, true)}</dd></div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Tokens, device details, session secrets, and IP history are never shown here. Multi-device sessions and two-factor authentication are not enabled in the current authentication system.</p>
      </div>

      <form className="grid gap-4 rounded-xl border border-border bg-muted p-5" onSubmit={changePassword}>
        <div><h3 className="text-base font-bold text-card-foreground">Change password</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Use at least 8 characters with letters and numbers. Passwords are handled only by Supabase Auth.</p></div>
        <div className="grid gap-2"><FieldLabel htmlFor="recruiter-new-password">New password</FieldLabel><input aria-describedby={error ? "recruiter-password-error" : undefined} autoComplete="new-password" className={inputClassName} id="recruiter-new-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></div>
        <div className="grid gap-2"><FieldLabel htmlFor="recruiter-confirm-password">Confirm new password</FieldLabel><input autoComplete="new-password" className={inputClassName} id="recruiter-confirm-password" onChange={(event) => setConfirmation(event.target.value)} type="password" value={confirmation} /></div>
        {error ? <p aria-live="polite" className="text-sm font-semibold text-destructive" id="recruiter-password-error" role="alert">{error}</p> : null}
        <button className="inline-flex h-11 w-fit items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Updating password..." : "Update password"}</button>
      </form>

      <div className="rounded-xl border border-border bg-muted p-5">
        <h3 className="text-base font-bold text-card-foreground">Current session</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Sign out from this browser if you are finished using the workspace.</p>
        <button className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold text-card-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200" onClick={() => void logout()} type="button">Sign out</button>
      </div>
    </div>
  );
}

function RecruiterPreferencePanel({
  emailOnly = false,
  profile,
}: {
  emailOnly?: boolean;
  profile: DashboardProfile;
}) {
  const [preferences, setPreferences] = useState<RecruiterNotificationPreferences>(defaultRecruiterNotificationPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void getRecruiterNotificationPreferences(profile.id).then((result) => {
      if (!active) return;
      setPreferences(result.preferences);
      setIsLoading(false);
      if (result.error) showErrorToast(result.error);
    });
    return () => { active = false; };
  }, [profile.id]);

  async function save(next: RecruiterNotificationPreferences) {
    if (isSaving) return;
    const previous = preferences;
    setPreferences(next);
    setIsSaving(true);
    const result = await updateRecruiterNotificationPreferences({ preferences: next, userId: profile.id });
    setIsSaving(false);
    if (result.error) {
      setPreferences(previous);
      showErrorToast(result.error);
      return;
    }
    setPreferences(result.preferences);
    showSuccessToast(emailOnly ? "Email preferences updated." : "Notification preferences updated.");
  }

  if (isLoading) {
    return <div aria-busy="true" className="rounded-xl border border-border bg-muted p-5 text-sm text-muted-foreground" role="status">Loading preferences...</div>;
  }

  return (
    <div aria-busy={isSaving ? "true" : undefined} className="grid gap-3">
      <p className="rounded-xl border border-border bg-muted p-4 text-sm leading-6 text-muted-foreground">Preferences are stored in the existing notification foundation. Delivery is controlled separately by the platform notification workers.</p>
      {!emailOnly ? <>
        <PreferenceRow description="Receive an in-app notification when a new application arrives." label="New applications"><PreferenceToggle checked={preferences.newApplicationInApp} disabled={isSaving} label="In-app" onChange={(checked) => void save({ ...preferences, newApplicationInApp: checked })} /></PreferenceRow>
        <PreferenceRow description="Receive an in-app notification when a candidate's application status changes." label="Candidate status updates"><PreferenceToggle checked={preferences.candidateStatusUpdatesInApp} disabled={isSaving} label="In-app" onChange={(checked) => void save({ ...preferences, candidateStatusUpdatesInApp: checked })} /></PreferenceRow>
        <PreferenceRow description="Reminders for scheduled interviews." label="Interview reminders"><PreferenceToggle checked={preferences.interviewRemindersInApp} disabled={isSaving} label="In-app" onChange={(checked) => void save({ ...preferences, interviewRemindersInApp: checked })} /></PreferenceRow>
        <PreferenceRow description="Changes to an interview schedule." label="Interview rescheduled"><PreferenceToggle checked={preferences.interviewRescheduledInApp} disabled={isSaving} label="In-app" onChange={(checked) => void save({ ...preferences, interviewRescheduledInApp: checked })} /></PreferenceRow>
        <PreferenceRow description="Interview cancellations for your applicants." label="Interview cancelled"><PreferenceToggle checked={preferences.interviewCancelledInApp} disabled={isSaving} label="In-app" onChange={(checked) => void save({ ...preferences, interviewCancelledInApp: checked })} /></PreferenceRow>
        <PreferenceRow description="Reminders when a job is approaching expiry." label="Job expiry reminders"><PreferenceToggle checked={preferences.jobExpiryRemindersInApp} disabled={isSaving} label="In-app" onChange={(checked) => void save({ ...preferences, jobExpiryRemindersInApp: checked })} /></PreferenceRow>
        <PreferenceRow description="Important messages sent by the platform team." label="Admin messages"><PreferenceToggle checked={preferences.adminMessagesInApp} disabled={isSaving} label="In-app" onChange={(checked) => void save({ ...preferences, adminMessagesInApp: checked })} /></PreferenceRow>
        <PreferenceRow description="Account and security alerts remain enabled." label="Account and security alerts"><PreferenceToggle checked disabled label="Always on" onChange={() => undefined} /></PreferenceRow>
      </> : null}
      {emailOnly ? <>
        <PreferenceRow description="Email when a new application arrives." label="New applications"><PreferenceToggle checked={preferences.newApplicationEmail} disabled={isSaving} label="Email" onChange={(checked) => void save({ ...preferences, newApplicationEmail: checked })} /></PreferenceRow>
        <PreferenceRow description="Email when a candidate's application status changes." label="Candidate status updates"><PreferenceToggle checked={preferences.candidateStatusUpdatesEmail} disabled={isSaving} label="Email" onChange={(checked) => void save({ ...preferences, candidateStatusUpdatesEmail: checked })} /></PreferenceRow>
        <PreferenceRow description="Email reminders for scheduled interviews." label="Interview reminders"><PreferenceToggle checked={preferences.interviewRemindersEmail} disabled={isSaving} label="Email" onChange={(checked) => void save({ ...preferences, interviewRemindersEmail: checked })} /></PreferenceRow>
        <PreferenceRow description="Email when an interview is rescheduled." label="Interview rescheduled"><PreferenceToggle checked={preferences.interviewRescheduledEmail} disabled={isSaving} label="Email" onChange={(checked) => void save({ ...preferences, interviewRescheduledEmail: checked })} /></PreferenceRow>
        <PreferenceRow description="Email when an interview is cancelled." label="Interview cancelled"><PreferenceToggle checked={preferences.interviewCancelledEmail} disabled={isSaving} label="Email" onChange={(checked) => void save({ ...preferences, interviewCancelledEmail: checked })} /></PreferenceRow>
        <PreferenceRow description="Email reminders when a job is approaching expiry." label="Job expiry reminders"><PreferenceToggle checked={preferences.jobExpiryRemindersEmail} disabled={isSaving} label="Email" onChange={(checked) => void save({ ...preferences, jobExpiryRemindersEmail: checked })} /></PreferenceRow>
        <PreferenceRow description="Important messages sent by the platform team." label="Admin messages"><PreferenceToggle checked={preferences.adminMessagesEmail} disabled={isSaving} label="Email" onChange={(checked) => void save({ ...preferences, adminMessagesEmail: checked })} /></PreferenceRow>
        <PreferenceRow description="Product news and platform improvements. Optional." label="Product updates"><PreferenceToggle checked={preferences.productUpdatesEmail} disabled={isSaving} label="Email" onChange={(checked) => void save({ ...preferences, productUpdatesEmail: checked })} /></PreferenceRow>
        <PreferenceRow description="Verification, password reset, and security messages remain enabled." label="Security emails"><PreferenceToggle checked disabled label="Always on" onChange={() => undefined} /></PreferenceRow>
      </> : null}
    </div>
  );
}

export function RecruiterNotificationsSettingsPanel({ profile }: { profile: DashboardProfile }) {
  return <RecruiterPreferencePanel profile={profile} />;
}

export function RecruiterEmailPreferencesPanel({ profile }: { profile: DashboardProfile }) {
  return <RecruiterPreferencePanel emailOnly profile={profile} />;
}

export function RecruiterDangerZonePanel() {
  const [request, setRequest] = useState<RecruiterDeletionRequest | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void getRecruiterDeletionRequest().then((result) => {
      if (!active) return;
      setRequest(result.request);
      setIsLoading(false);
      if (result.error) showErrorToast(result.error);
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== "DELETE MY ACCOUNT" || isSaving) {
      showErrorToast("Type DELETE MY ACCOUNT to confirm.");
      return;
    }

    setIsSaving(true);
    const result = await requestRecruiterAccountDeletion(reason);
    setIsSaving(false);
    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setRequest(result.request);
    setConfirmation("");
    showSuccessToast("Your account deletion request was submitted for review.");
  }

  if (isLoading) {
    return <div aria-busy="true" className="rounded-xl border border-border bg-muted p-5 text-sm text-muted-foreground" role="status">Loading account deletion status...</div>;
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-5 dark:border-red-300/20 dark:bg-red-300/10">
      <h3 className="text-base font-bold text-red-900 dark:text-red-100">Request account deactivation</h3>
      <p className="mt-2 text-sm leading-6 text-red-800/80 dark:text-red-100/80">This creates a review request. It does not immediately delete your company, jobs, applications, or legally required hiring records.</p>
      {request ? <p className="mt-4 rounded-xl border border-red-200/70 bg-white/60 p-4 text-sm font-semibold text-red-900 dark:border-red-200/20 dark:bg-black/10 dark:text-red-100">Request status: {request.status.replaceAll("_", " ")}</p> : <form className="mt-5 grid gap-4" onSubmit={submit}>
        <label className="grid gap-2 text-sm font-semibold text-red-900 dark:text-red-100" htmlFor="recruiter-deletion-reason">Reason (optional)<textarea className={textareaClassName} id="recruiter-deletion-reason" maxLength={4000} onChange={(event) => setReason(event.target.value)} value={reason} /></label>
        <label className="grid gap-2 text-sm font-semibold text-red-900 dark:text-red-100" htmlFor="recruiter-delete-confirmation">Type DELETE MY ACCOUNT to confirm<input className={inputClassName} id="recruiter-delete-confirmation" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /></label>
        <button className="inline-flex h-11 w-fit items-center justify-center rounded-xl border border-red-300 bg-red-600 px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving || confirmation !== "DELETE MY ACCOUNT"} type="submit">{isSaving ? "Submitting request..." : "Request account deactivation"}</button>
      </form>}
    </div>
  );
}

export function RecruiterSettingsSection({
  activeSectionId,
  profile,
}: {
  activeSectionId: SettingsSectionId;
  profile: DashboardProfile;
}) {
  if (activeSectionId === "profile") {
    return <RecruiterProfileSettingsPanel profile={profile} />;
  }

  if (activeSectionId === "account") {
    return <RecruiterAccountSettingsPanel profile={profile} />;
  }

  if (activeSectionId === "notifications") {
    return <RecruiterNotificationsSettingsPanel profile={profile} />;
  }

  if (activeSectionId === "preferences") {
    return <RecruiterEmailPreferencesPanel profile={profile} />;
  }

  if (activeSectionId === "security") {
    return <RecruiterSecuritySettingsPanel profile={profile} />;
  }

  if (activeSectionId === "danger") {
    return <RecruiterDangerZonePanel />;
  }

  return null;
}
