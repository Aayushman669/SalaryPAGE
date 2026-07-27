"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import ThemeSelector from "../theme/theme-selector";
import {
  getSettingsSectionHref,
  getSettingsSectionsForRole,
  type SettingsSection,
  type SettingsSectionId,
} from "@/lib/settings";
import type { DashboardProfile } from "@/lib/dashboard-data";

type SettingsLayoutProps = {
  activeSectionId: SettingsSectionId;
  children: ReactNode;
  onClose: () => void;
  profile: DashboardProfile;
};

type SettingsSectionPanelProps = {
  children?: ReactNode;
  section: SettingsSection;
};

const focusableSelector =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const iconLabels: Record<SettingsSection["icon"], string> = {
  account: "Account",
  appearance: "Appearance",
  billing: "Billing",
  danger: "Danger",
  "job-alerts": "Job Alerts",
  notifications: "Notifications",
  preferences: "Preferences",
  privacy: "Privacy",
  profile: "Profile",
  security: "Security",
};

function SettingsIcon({ icon }: { icon: SettingsSection["icon"] }) {
  return (
    <span
      aria-hidden="true"
      title={iconLabels[icon]}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-300 bg-yellow-50 text-xs font-black uppercase text-gray-900"
    >
      {iconLabels[icon].slice(0, 1)}
    </span>
  );
}

function AvailabilityBadge({
  availability,
}: {
  availability: SettingsSection["availability"];
}) {
  const label = availability === "available" ? "Ready" : "Coming Soon";

  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-gray-900">
      {label}
    </span>
  );
}

function SettingsNavigation({
  activeSectionId,
  role,
}: {
  activeSectionId: SettingsSectionId;
  role: DashboardProfile["role_mode"];
}) {
  const sections = getSettingsSectionsForRole(role);

  return (
    <nav
      aria-label="Settings sections"
      className="lg:sticky lg:top-8 lg:self-start"
    >
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-[0_18px_45px_rgba(17,24,39,0.06)] lg:grid lg:min-w-72 lg:overflow-visible">
        {sections.map((section) => {
          const active = section.id === activeSectionId;

          return (
            <Link
              key={section.id}
              href={getSettingsSectionHref(section.id)}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-[15rem] items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-yellow-200 lg:min-w-0 ${
                active
                  ? "border-yellow-300 bg-yellow-50/70 text-card-foreground"
                  : "border-transparent text-muted-foreground hover:border-yellow-200 hover:bg-yellow-50/40 hover:text-card-foreground"
              }`}
            >
              <SettingsIcon icon={section.icon} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold">
                    {section.title}
                  </span>
                </span>
                <span className="mt-1 line-clamp-2 text-xs leading-5">
                  {section.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function CloseSettingsButton({
  buttonRef,
  onClose,
}: {
  buttonRef?: Ref<HTMLButtonElement>;
  onClose: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="Close settings"
      onClick={onClose}
      className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-sm font-bold text-muted-foreground shadow-[0_10px_24px_rgba(17,24,39,0.08)] transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50 hover:text-card-foreground focus:outline-none focus:ring-4 focus:ring-yellow-200"
    >
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    </button>
  );
}

export function SettingsSectionPanel({
  children,
  section,
}: SettingsSectionPanelProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_18px_45px_rgba(17,24,39,0.08)] sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <SettingsIcon icon={section.icon} />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-card-foreground">
              {section.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {section.description}
            </p>
          </div>
        </div>
        <AvailabilityBadge availability={section.availability} />
      </div>

      <div className="mt-8">{children}</div>
    </section>
  );
}

export function SettingsComingSoon() {
  return (
    <div className="rounded-xl border border-border bg-muted px-5 py-6">
      <p className="text-sm font-bold text-card-foreground">Coming Soon</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        This settings area is prepared for future Supabase-backed preferences
        and account controls.
      </p>
    </div>
  );
}

export function SettingsBillingPanel() {
  return (
    <div className="rounded-xl border border-border bg-muted px-5 py-6">
      <h3 className="text-base font-bold text-card-foreground">
        Plans and payments
      </h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        Review your current plan, usage limits, payment history, and receipts in
        the secure recruiter billing area.
      </p>
      <Link
        href="/dashboard/billing"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
      >
        Open Billing
      </Link>
    </div>
  );
}

export function SettingsAppearancePanel({ profile }: { profile: DashboardProfile }) {
  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-border bg-muted px-5 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-card-foreground">
              Theme preference
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Light remains the default experience. Dark and system preferences
              are saved locally and synced to your recruiter profile.
            </p>
          </div>
          <ThemeSelector enableProfileSync userId={profile.id} />
        </div>
      </div>
    </div>
  );
}

export function SettingsLayout({
  activeSectionId,
  children,
  onClose,
  profile,
}: SettingsLayoutProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const focusId = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    function getFocusableElements() {
      return Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ??
          [],
      ).filter((element) => !element.hasAttribute("disabled"));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusId);
      document.removeEventListener("keydown", handleKeyDown);

      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  return (
    <main className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-foreground/20 px-4 py-5 text-foreground backdrop-blur-sm sm:px-6">
      <section
        ref={dialogRef}
        aria-labelledby="settings-title"
        aria-modal="true"
        role="dialog"
        tabIndex={-1}
        className="relative mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-[0_30px_90px_rgba(17,24,39,0.22)]"
      >
        <CloseSettingsButton buttonRef={closeButtonRef} onClose={onClose} />
        <div className="overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          <div className="pr-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Settings
            </p>
            <h1
              id="settings-title"
              className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            >
              Settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              Manage the recruiter profile, account access, notifications, and
              security controls used across your hiring workspace.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <SettingsNavigation
              activeSectionId={activeSectionId}
              role={profile.role_mode}
            />
            <div className="min-w-0">{children}</div>
          </div>
        </div>
      </section>
    </main>
  );
}

export function SettingsSkeleton({ onClose }: { onClose?: () => void }) {
  return (
    <main
      aria-busy="true"
      aria-label="Loading settings"
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-foreground/20 px-4 py-5 text-foreground backdrop-blur-sm sm:px-6"
      role="status"
    >
      <section className="relative mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-background p-6 shadow-[0_30px_90px_rgba(17,24,39,0.22)] sm:p-8">
        {onClose ? <CloseSettingsButton onClose={onClose} /> : null}
        <div className="animate-pulse pr-12">
          <div className="h-3 w-24 rounded-full bg-gray-100" />
          <div className="mt-4 h-10 w-56 rounded-2xl bg-gray-100" />
          <div className="mt-4 h-5 w-full max-w-2xl rounded-full bg-gray-100" />
          <div className="mt-3 h-5 w-2/3 max-w-xl rounded-full bg-gray-100" />
          <div className="mt-8 grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="h-96 rounded-2xl border border-border bg-card shadow-[0_18px_45px_rgba(17,24,39,0.06)]" />
            <div className="h-80 rounded-2xl border border-border bg-card shadow-[0_18px_45px_rgba(17,24,39,0.08)]" />
          </div>
        </div>
      </section>
    </main>
  );
}

export function SettingsError({
  message,
  onClose,
  onRetry,
}: {
  message: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <main className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-foreground/20 px-4 py-5 text-foreground backdrop-blur-sm sm:px-6">
      <section
        aria-labelledby="settings-error-title"
        aria-modal="true"
        role="dialog"
        className="relative max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[0_30px_90px_rgba(17,24,39,0.22)]"
      >
        <CloseSettingsButton onClose={onClose} />
        <h1
          id="settings-error-title"
          className="text-xl font-bold tracking-tight text-card-foreground"
        >
          Settings unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
        >
          Retry
        </button>
      </section>
    </main>
  );
}
