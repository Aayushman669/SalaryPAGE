"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { DashboardProfile } from "@/lib/dashboard-data";
import type { SettingsSectionId } from "@/lib/settings";
import CandidateProfileSettingsPanel from "./candidate-profile-settings-panel";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import {
  defaultCandidateNotificationPreferences,
  defaultCandidatePrivacySettings,
  getCandidateDeletionRequest,
  getCandidateNotificationPreferences,
  getCandidatePrivacySettings,
  requestCandidateAccountDeletion,
  updateCandidateNotificationPreferences,
  updateCandidatePrivacySettings,
  validateCandidatePassword,
  type CandidateDeletionRequest,
  type CandidateNotificationPreferences,
  type CandidatePrivacySettings,
} from "@/lib/candidate-settings";
import {
  jobAlertFrequencies,
  loadCandidateJobAlerts,
  setCandidateJobAlertEnabled,
  setCandidateJobAlertFrequency,
  type JobAlert,
  type JobAlertFrequency,
} from "@/lib/job-alerts";

function Toggle({
  checked,
  description,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted px-4 py-4">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-card-foreground">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">{description}</span>
      </span>
      <input
        aria-label={label}
        checked={checked}
        className="mt-1 h-5 w-5 shrink-0 rounded border-border text-accent focus:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function SelectField({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <select
        className="h-11 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-card-foreground outline-none focus:border-accent focus:ring-4 focus:ring-yellow-200"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}

export function CandidateAccountSettingsPanel({ profile }: { profile: DashboardProfile }) {
  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-border bg-muted px-5 py-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Sign-in email</p>
        <p className="mt-2 break-all text-sm font-semibold text-card-foreground">{profile.email || "Email unavailable"}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Email changes require a verified authentication flow or support. This page does not change your sign-in email.
        </p>
      </div>
      <CandidateProfileSettingsPanel profile={profile} />
    </div>
  );
}

export function CandidatePrivacySettingsPanel() {
  const [settings, setSettings] = useState<CandidatePrivacySettings>(defaultCandidatePrivacySettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void getCandidatePrivacySettings().then((result) => {
      if (!active) return;
      setSettings(result.settings);
      setIsLoading(false);
      if (result.error) showErrorToast(result.error);
    });
    return () => { active = false; };
  }, []);

  async function save(next: CandidatePrivacySettings) {
    if (isSaving) return;
    const previous = settings;
    setSettings(next);
    setIsSaving(true);
    const result = await updateCandidatePrivacySettings(next);
    setIsSaving(false);
    if (result.error) {
      setSettings(previous);
      showErrorToast(result.error);
      return;
    }
    setSettings(result.settings);
    showSuccessToast("Privacy settings updated.");
  }

  if (isLoading) return <div aria-busy="true" className="rounded-xl border border-border bg-muted p-5 text-sm text-muted-foreground">Loading privacy settings...</div>;

  return (
    <div className="grid gap-4" aria-busy={isSaving ? "true" : undefined}>
      <SelectField label="Profile visibility" onChange={(value) => void save({ ...settings, profileVisibility: value as CandidatePrivacySettings["profileVisibility"] })} value={settings.profileVisibility}>
        <option value="application_only">Only recruiters connected to my applications</option>
        <option value="private">Private</option>
      </SelectField>
      <SelectField label="Resume visibility" onChange={(value) => void save({ ...settings, resumeVisibility: value as CandidatePrivacySettings["resumeVisibility"] })} value={settings.resumeVisibility}>
        <option value="application_only">Only recruiters connected to my applications</option>
        <option value="private">Private</option>
      </SelectField>
      <Toggle checked={settings.recruiterDiscoverable} description="Keep this off unless you intentionally want future recruiter discovery features." label="Recruiter discoverability" onChange={(checked) => void save({ ...settings, recruiterDiscoverable: checked })} />
      <Toggle checked={settings.showPortfolio} description="Allow authorized recruiters to see portfolio links on your applicant profile." label="Show portfolio links" onChange={(checked) => void save({ ...settings, showPortfolio: checked })} />
      <Toggle checked={settings.showSocialLinks} description="Allow authorized recruiters to see linked social profiles." label="Show social links" onChange={(checked) => void save({ ...settings, showSocialLinks: checked })} />
      <Toggle checked={settings.showLocation} description="Control whether your location is included in authorized applicant views." label="Show location" onChange={(checked) => void save({ ...settings, showLocation: checked })} />
      <Toggle checked={settings.showExperience} description="Control whether years of experience is included in authorized applicant views." label="Show years of experience" onChange={(checked) => void save({ ...settings, showExperience: checked })} />
      <p className="text-sm leading-6 text-muted-foreground">Candidate profiles are not publicly searchable. Resume files remain in private storage.</p>
    </div>
  );
}

function PreferenceRow({
  children,
  label,
  description,
}: {
  children: ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-sm font-bold text-card-foreground">{label}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div>
        <div className="flex shrink-0 flex-wrap gap-4">{children}</div>
      </div>
    </div>
  );
}

function ChannelToggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex items-center gap-2 text-xs font-semibold text-card-foreground"><input aria-label={label} checked={checked} className="h-4 w-4 rounded border-border text-accent focus:ring-yellow-300" onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>;
}

export function CandidateNotificationsSettingsPanel({ profile }: { profile: DashboardProfile }) {
  const [preferences, setPreferences] = useState<CandidateNotificationPreferences>(defaultCandidateNotificationPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void getCandidateNotificationPreferences(profile.id).then((result) => {
      if (!active) return;
      setPreferences(result.preferences);
      setIsLoading(false);
      if (result.error) showErrorToast(result.error);
    });
    return () => { active = false; };
  }, [profile.id]);

  async function save(next: CandidateNotificationPreferences) {
    if (isSaving) return;
    const previous = preferences;
    setPreferences(next);
    setIsSaving(true);
    const result = await updateCandidateNotificationPreferences({ preferences: next, userId: profile.id });
    setIsSaving(false);
    if (result.error) { setPreferences(previous); showErrorToast(result.error); return; }
    setPreferences(result.preferences);
    showSuccessToast("Notification preferences updated.");
  }

  if (isLoading) return <div aria-busy="true" className="rounded-xl border border-border bg-muted p-5 text-sm text-muted-foreground">Loading notification preferences...</div>;

  return (
    <div className="grid gap-3" aria-busy={isSaving ? "true" : undefined}>
      <p className="rounded-xl border border-border bg-muted p-4 text-sm leading-6 text-muted-foreground">Delivery is being prepared by the notification foundation. Your preferences are stored now and will be respected when delivery is enabled.</p>
      <PreferenceRow description="Updates when recruiters move an application through the hiring workflow." label="Application status updates"><ChannelToggle checked={preferences.applicationUpdatesEmail} label="Email" onChange={(checked) => void save({ ...preferences, applicationUpdatesEmail: checked })} /><ChannelToggle checked={preferences.applicationUpdatesInApp} label="In-app" onChange={(checked) => void save({ ...preferences, applicationUpdatesInApp: checked })} /></PreferenceRow>
      <PreferenceRow description="Matches from your saved job alerts." label="Job alert matches"><ChannelToggle checked={preferences.jobAlertsEmail} label="Email" onChange={(checked) => void save({ ...preferences, jobAlertsEmail: checked })} /><ChannelToggle checked={preferences.jobAlertsInApp} label="In-app" onChange={(checked) => void save({ ...preferences, jobAlertsInApp: checked })} /></PreferenceRow>
      <PreferenceRow description="New roles that may be relevant to your profile preferences." label="Relevant jobs"><ChannelToggle checked={preferences.relevantJobsEmail} label="Email" onChange={(checked) => void save({ ...preferences, relevantJobsEmail: checked })} /><ChannelToggle checked={preferences.relevantJobsInApp} label="In-app" onChange={(checked) => void save({ ...preferences, relevantJobsInApp: checked })} /></PreferenceRow>
      <PreferenceRow description="Occasional reminders about roles you saved." label="Saved job reminders"><ChannelToggle checked={preferences.savedJobRemindersEmail} label="Email" onChange={(checked) => void save({ ...preferences, savedJobRemindersEmail: checked })} /></PreferenceRow>
      <PreferenceRow description="Product news and improvements. This is optional." label="Product announcements"><ChannelToggle checked={preferences.productUpdatesEmail} label="Email" onChange={(checked) => void save({ ...preferences, productUpdatesEmail: checked })} /><ChannelToggle checked={preferences.productUpdatesInApp} label="In-app" onChange={(checked) => void save({ ...preferences, productUpdatesInApp: checked })} /></PreferenceRow>
      <PreferenceRow description="Important messages sent by the platform team." label="Admin messages"><ChannelToggle checked={preferences.adminMessagesEmail} label="Email" onChange={(checked) => void save({ ...preferences, adminMessagesEmail: checked })} /><ChannelToggle checked={preferences.adminMessagesInApp} label="In-app" onChange={(checked) => void save({ ...preferences, adminMessagesInApp: checked })} /></PreferenceRow>
      <PreferenceRow description="Payment and account-critical updates. These remain enabled." label="Billing and security updates"><ChannelToggle checked label="Email" onChange={() => undefined} /><ChannelToggle checked={preferences.billingUpdatesInApp} label="Billing in-app" onChange={(checked) => void save({ ...preferences, billingUpdatesInApp: checked })} /><ChannelToggle checked label="Security in-app" onChange={() => undefined} /></PreferenceRow>
    </div>
  );
}

export function CandidateJobAlertsSettingsPanel({ profile }: { profile: DashboardProfile }) {
  const [preferences, setPreferences] = useState<CandidateNotificationPreferences>(defaultCandidateNotificationPreferences);
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([getCandidateNotificationPreferences(profile.id), loadCandidateJobAlerts(1, 10)]).then(([preferenceResult, alertResult]) => {
      if (!active) return;
      setPreferences(preferenceResult.preferences);
      setAlerts(alertResult.alerts);
      setIsLoading(false);
      if (preferenceResult.error || alertResult.error) showErrorToast(preferenceResult.error ?? alertResult.error ?? "We could not load job alerts.");
    });
    return () => { active = false; };
  }, [profile.id]);

  async function saveGlobal(next: CandidateNotificationPreferences) {
    if (isSaving) return;
    setIsSaving(true);
    const result = await updateCandidateNotificationPreferences({ preferences: next, userId: profile.id });
    setIsSaving(false);
    if (result.error) { showErrorToast(result.error); return; }
    setPreferences(result.preferences);
    showSuccessToast("Job alert preferences updated.");
  }

  async function updateAlert(alert: JobAlert, changes: Partial<JobAlert>) {
    const previous = alerts;
    const next = alerts.map((item) => item.id === alert.id ? { ...item, ...changes } : item);
    setAlerts(next);
    const result = changes.frequency
      ? await setCandidateJobAlertFrequency(alert.id, changes.frequency)
      : await setCandidateJobAlertEnabled(alert.id, changes.enabled ?? alert.enabled);
    if (result.error) { setAlerts(previous); showErrorToast(result.error); return; }
    showSuccessToast("Job alert updated.");
  }

  if (isLoading) return <div aria-busy="true" className="rounded-xl border border-border bg-muted p-5 text-sm text-muted-foreground">Loading job alert preferences...</div>;

  return (
    <div className="grid gap-5" aria-busy={isSaving ? "true" : undefined}>
      <div className="grid gap-4 rounded-xl border border-border bg-muted p-5">
        <Toggle checked={preferences.jobAlertsEnabled} description="Pause all alert matching without deleting individual alerts." label="Enable all job alerts" onChange={(checked) => void saveGlobal({ ...preferences, jobAlertsEnabled: checked })} />
        <SelectField label="Default alert frequency" onChange={(value) => void saveGlobal({ ...preferences, jobAlertsFrequency: value as JobAlertFrequency })} value={preferences.jobAlertsFrequency}>
          {jobAlertFrequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency.charAt(0).toUpperCase() + frequency.slice(1)}</option>)}
        </SelectField>
      </div>
      <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-card-foreground">Individual alerts</h3><p className="mt-1 text-sm text-muted-foreground">Enable, pause, or set the frequency of each saved search.</p></div><Link className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200" href="/job-alerts">Manage Alerts</Link></div>
      {alerts.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-muted p-6 text-center text-sm text-muted-foreground">No active alerts. Create an alert to start matching future jobs.</div> : <div className="grid gap-3">{alerts.map((alert) => <div className="rounded-xl border border-border bg-muted p-4" key={alert.id}><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-bold text-card-foreground">{alert.alertName}</p><p className="mt-1 text-xs text-muted-foreground">{alert.enabled ? "Enabled" : "Paused"} - {alert.frequency}</p></div><div className="flex flex-wrap items-center gap-3"><SelectField label="Frequency" onChange={(value) => void updateAlert(alert, { frequency: value as JobAlertFrequency })} value={alert.frequency}><option value="instant">Instant</option><option value="daily">Daily</option><option value="weekly">Weekly</option></SelectField><Toggle checked={alert.enabled} description="" label={alert.enabled ? "Enabled" : "Paused"} onChange={(checked) => void updateAlert(alert, { enabled: checked })} /></div></div></div>)}</div>}
    </div>
  );
}

export function CandidateSecuritySettingsPanel({ profile }: { profile: DashboardProfile }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState({ confirmed: false, createdAt: null as string | null, lastSignIn: null as string | null });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setAccountInfo({ confirmed: Boolean(data.user?.email_confirmed_at), createdAt: data.user?.created_at ?? null, lastSignIn: data.user?.last_sign_in_at ?? null });
    });
  }, []);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateCandidatePassword(password, confirmation);
    if (validationError) { setError(validationError); return; }
    if (!supabase) { setError("Supabase is not configured."); return; }
    setError(null);
    setIsSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSaving(false);
    if (updateError) { setError("We could not update your password. Your session may have expired."); return; }
    setPassword("");
    setConfirmation("");
    showSuccessToast("Password updated successfully.");
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-border bg-muted p-5"><h3 className="text-sm font-bold text-card-foreground">Account security</h3><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Sign-in email</dt><dd className="mt-1 break-all font-semibold text-card-foreground">{profile.email || "Email unavailable"}</dd></div><div><dt className="text-muted-foreground">Email verification</dt><dd className="mt-1 font-semibold text-card-foreground">{accountInfo.confirmed ? "Verified" : "Not verified"}</dd></div><div><dt className="text-muted-foreground">Last sign-in</dt><dd className="mt-1 font-semibold text-card-foreground">{accountInfo.lastSignIn ? new Date(accountInfo.lastSignIn).toLocaleString() : "Not available"}</dd></div><div><dt className="text-muted-foreground">Account created</dt><dd className="mt-1 font-semibold text-card-foreground">{accountInfo.createdAt ? new Date(accountInfo.createdAt).toLocaleDateString() : "Not available"}</dd></div></dl></div>
      <form className="grid gap-4 rounded-xl border border-border bg-muted p-5" onSubmit={changePassword}><div><h3 className="text-sm font-bold text-card-foreground">Change password</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Use at least 8 characters with upper, lower, and numeric characters.</p></div><label className="grid gap-2 text-sm font-semibold text-card-foreground">New password<input aria-describedby={error ? "password-error" : undefined} autoComplete="new-password" className="h-11 rounded-xl border border-border bg-card px-3 text-card-foreground outline-none focus:border-accent focus:ring-4 focus:ring-yellow-200" onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></label><label className="grid gap-2 text-sm font-semibold text-card-foreground">Confirm new password<input autoComplete="new-password" className="h-11 rounded-xl border border-border bg-card px-3 text-card-foreground outline-none focus:border-accent focus:ring-4 focus:ring-yellow-200" onChange={(event) => setConfirmation(event.target.value)} type="password" value={confirmation} /></label>{error ? <p aria-live="polite" className="text-sm font-semibold text-destructive" id="password-error">{error}</p> : null}<button className="inline-flex h-11 w-fit items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Updating..." : "Update Password"}</button></form>
    </div>
  );
}

export function CandidateDangerZonePanel() {
  const [request, setRequest] = useState<CandidateDeletionRequest | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { void getCandidateDeletionRequest().then((result) => { setRequest(result.request); setIsLoading(false); if (result.error) showErrorToast(result.error); }); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== "DELETE MY ACCOUNT") { showErrorToast("Type DELETE MY ACCOUNT to confirm."); return; }
    setIsSaving(true);
    const result = await requestCandidateAccountDeletion(reason);
    setIsSaving(false);
    if (result.error) { showErrorToast(result.error); return; }
    setRequest(result.request);
    setConfirmation("");
    showSuccessToast("Your deletion request was submitted for review.");
  }

  if (isLoading) return <div aria-busy="true" className="rounded-xl border border-border bg-muted p-5 text-sm text-muted-foreground">Loading account deletion status...</div>;

  return <div className="rounded-xl border border-red-200 bg-red-50/60 p-5 dark:border-red-300/20 dark:bg-red-300/10"><h3 className="text-sm font-bold text-red-900 dark:text-red-100">Request account deletion</h3><p className="mt-2 text-sm leading-6 text-red-800/80 dark:text-red-100/80">This creates a review request. It does not immediately delete your account, applications, or legally required records.</p>{request ? <p className="mt-4 rounded-xl border border-red-200/70 bg-white/60 p-4 text-sm font-semibold text-red-900 dark:border-red-200/20 dark:bg-black/10 dark:text-red-100">Request status: {request.status.replaceAll("_", " ")}</p> : <form className="mt-5 grid gap-4" onSubmit={submit}><label className="grid gap-2 text-sm font-semibold text-red-900 dark:text-red-100">Reason (optional)<textarea className="min-h-24 rounded-xl border border-red-200 bg-white px-3 py-3 text-gray-900 outline-none focus:ring-4 focus:ring-red-200 dark:border-red-200/20 dark:bg-black/10 dark:text-white" onChange={(event) => setReason(event.target.value)} value={reason} /></label><label className="grid gap-2 text-sm font-semibold text-red-900 dark:text-red-100">Type DELETE MY ACCOUNT to confirm<input className="h-11 rounded-xl border border-red-200 bg-white px-3 text-gray-900 outline-none focus:ring-4 focus:ring-red-200 dark:border-red-200/20 dark:bg-black/10 dark:text-white" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /></label><button className="inline-flex h-11 w-fit items-center justify-center rounded-xl border border-red-300 bg-red-600 px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving || confirmation !== "DELETE MY ACCOUNT"} type="submit">{isSaving ? "Submitting..." : "Request Account Deletion"}</button></form>}</div>;
}

export function CandidateSettingsSection({
  activeSectionId,
  profile,
}: {
  activeSectionId: SettingsSectionId;
  profile: DashboardProfile;
}) {
  if (activeSectionId === "profile") {
    return <CandidateAccountSettingsPanel profile={profile} />;
  }

  if (activeSectionId === "notifications") {
    return <CandidateNotificationsSettingsPanel profile={profile} />;
  }

  if (activeSectionId === "privacy") {
    return <CandidatePrivacySettingsPanel />;
  }

  if (activeSectionId === "job-alerts") {
    return <CandidateJobAlertsSettingsPanel profile={profile} />;
  }

  if (activeSectionId === "security") {
    return <CandidateSecuritySettingsPanel profile={profile} />;
  }

  if (activeSectionId === "danger") {
    return <CandidateDangerZonePanel />;
  }

  return null;
}
