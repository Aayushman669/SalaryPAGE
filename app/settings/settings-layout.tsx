"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  type ReactNode,
  type Ref,
} from "react";
import {
  getSettingsSectionsForRole,
  type SettingsSection,
  type SettingsSectionId,
} from "@/lib/settings";
import type { DashboardProfile } from "@/lib/dashboard-data";

type SettingsLayoutProps = {
  activeSectionId: SettingsSectionId;
  children: ReactNode;
  onClose: () => void;
  onSectionChange: (sectionId: SettingsSectionId) => void;
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
  const commonProps = {
    "aria-hidden": true,
    className: "h-4 w-4",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.9,
    viewBox: "0 0 24 24",
  };

  const paths: Record<SettingsSection["icon"], ReactNode> = {
    account: (
      <>
        <path d="M4 7.5h16" />
        <path d="M6 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        <path d="M8 13h5" />
        <path d="M8 16h3" />
      </>
    ),
    billing: (
      <>
        <path d="M4 7h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
        <path d="M4 10h16" />
        <path d="M7.5 15h4" />
      </>
    ),
    danger: (
      <>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 4.5 2.8 17.4A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.6L13.7 4.5a2 2 0 0 0-3.4 0Z" />
      </>
    ),
    "job-alerts": (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M10 21h4" />
      </>
    ),
    notifications: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </>
    ),
    preferences: (
      <>
        <path d="M4 7h10" />
        <path d="M18 7h2" />
        <path d="M4 17h2" />
        <path d="M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </>
    ),
    privacy: (
      <>
        <path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z" />
        <path d="M9.5 12.5 11 14l3.5-4" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
    security: (
      <>
        <rect height="10" rx="2" width="14" x="5" y="10" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  };

  return (
    <span
      aria-hidden="true"
      title={iconLabels[icon]}
      className="settings-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e4e7f0] bg-white text-[#635bff] shadow-[0_8px_18px_rgba(30,40,80,0.035)]"
    >
      <svg {...commonProps}>{paths[icon]}</svg>
    </span>
  );
}

function AvailabilityBadge({
  availability,
}: {
  availability: SettingsSection["availability"];
}) {
  const label = availability === "available" ? "Ready" : "Coming Soon";

  if (availability === "available") {
    return null;
  }

  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-[#ded9ff] bg-[#f7f5ff] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#5d3cda]">
      {label}
    </span>
  );
}

function SettingsNavigation({
  activeSectionId,
  onSectionChange,
  role,
}: {
  activeSectionId: SettingsSectionId;
  onSectionChange: (sectionId: SettingsSectionId) => void;
  role: DashboardProfile["role_mode"];
}) {
  const sections = getSettingsSectionsForRole(role);

  return (
    <nav
      aria-label="Settings sections"
      className="lg:sticky lg:top-7 lg:self-start"
    >
      <div className="flex gap-2 overflow-x-auto rounded-[18px] border border-[#e4e7f0] bg-white p-2 shadow-[0_10px_35px_rgba(30,40,80,0.04)] lg:grid lg:min-w-[14.5rem] lg:overflow-visible">
        {sections.map((section) => {
          const active = section.id === activeSectionId;

          return (
            <button
              key={section.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onSectionChange(section.id)}
              className={`group relative flex min-h-11 min-w-[13.5rem] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-[#635bff]/10 lg:min-w-0 ${
                active
                  ? "bg-[#f7f5ff] text-[#0b1430]"
                  : "text-[#5f6b85] hover:bg-[#f8f9fc] hover:text-[#0b1430]"
              }`}
            >
              {active ? (
                <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-[#635bff]" />
              ) : null}
              <SettingsIcon icon={section.icon} />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">
                {section.title}
              </span>
            </button>
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
      className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#e4e7f0] bg-white text-sm font-bold text-[#5f6b85] shadow-[0_10px_24px_rgba(17,24,39,0.06)] transition-colors duration-200 hover:border-[#cfc8ff] hover:bg-[#f7f5ff] hover:text-[#0b1430] focus:outline-none focus:ring-4 focus:ring-[#635bff]/10"
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
    <section className="rounded-[18px] border border-[#e4e7f0] bg-white p-6 shadow-[0_10px_35px_rgba(30,40,80,0.04)] sm:p-8">
      <div className="flex flex-col gap-4 border-b border-[#edf0f6] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <SettingsIcon icon={section.icon} />
          <div>
            <h2 className="text-[1.35rem] font-bold leading-tight tracking-tight text-[#0b1430]">
              {section.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f6b85]">
              {section.description}
            </p>
          </div>
        </div>
        <AvailabilityBadge availability={section.availability} />
      </div>

      <div className="mt-7">{children}</div>
    </section>
  );
}

export function SettingsComingSoon() {
  return (
    <div className="rounded-xl border border-[#e4e7f0] bg-[#f8f9fc] px-5 py-6">
      <p className="text-sm font-bold text-[#0b1430]">Coming Soon</p>
      <p className="mt-2 text-sm leading-6 text-[#5f6b85]">
        This settings area is prepared for future Supabase-backed preferences
        and account controls.
      </p>
    </div>
  );
}

export function SettingsBillingPanel() {
  return (
    <div className="rounded-xl border border-[#e4e7f0] bg-[#f8f9fc] px-5 py-6">
      <h3 className="text-base font-bold text-[#0b1430]">
        Plans and payments
      </h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[#5f6b85]">
        Review your current plan, usage limits, payment history, and receipts in
        the secure recruiter billing area.
      </p>
      <Link
        href="/dashboard/billing"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#10162f] px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#1d2749] focus:outline-none focus:ring-4 focus:ring-[#635bff]/10"
      >
        Open Billing
      </Link>
    </div>
  );
}

export function SettingsLayout({
  activeSectionId,
  children,
  onClose,
  onSectionChange,
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
    <main className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-[#0b1430]/20 px-4 py-5 text-[#0b1430] backdrop-blur-sm sm:px-6">
      <section
        ref={dialogRef}
        aria-labelledby="settings-title"
        aria-modal="true"
        role="dialog"
        tabIndex={-1}
        className="relative mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-[#e4e7f0] bg-white shadow-[0_30px_90px_rgba(17,24,39,0.18)]"
      >
        <CloseSettingsButton buttonRef={closeButtonRef} onClose={onClose} />
        <div className="overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          <div className="pr-12">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#635bff]">
              SETTINGS
            </p>
            <h1
              id="settings-title"
              className="mt-3 text-4xl font-extrabold leading-none tracking-tight text-[#0b1430] sm:text-[2.45rem]"
            >
              Settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f6b85] sm:text-base sm:leading-7">
              Manage your account, preferences, and application settings.
            </p>
          </div>

          <div className="mt-9 grid gap-7 lg:grid-cols-[15rem_minmax(0,1fr)] xl:gap-9">
            <SettingsNavigation
              activeSectionId={activeSectionId}
              onSectionChange={onSectionChange}
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
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-[#0b1430]/20 px-4 py-5 text-[#0b1430] backdrop-blur-sm sm:px-6"
      role="status"
    >
      <section className="relative mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-[#e4e7f0] bg-white p-6 shadow-[0_30px_90px_rgba(17,24,39,0.18)] sm:p-8">
        {onClose ? <CloseSettingsButton onClose={onClose} /> : null}
        <div className="animate-pulse pr-12">
          <div className="h-3 w-24 rounded-full bg-[#f0edff]" />
          <div className="mt-4 h-10 w-56 rounded-2xl bg-[#f3f4fa]" />
          <div className="mt-4 h-5 w-full max-w-2xl rounded-full bg-[#f3f4fa]" />
          <div className="mt-3 h-5 w-2/3 max-w-xl rounded-full bg-[#f3f4fa]" />
          <div className="mt-9 grid gap-7 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <div className="h-96 rounded-[18px] border border-[#e4e7f0] bg-white shadow-[0_10px_35px_rgba(30,40,80,0.04)]" />
            <div className="h-80 rounded-[18px] border border-[#e4e7f0] bg-white shadow-[0_10px_35px_rgba(30,40,80,0.04)]" />
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
    <main className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-[#0b1430]/20 px-4 py-5 text-[#0b1430] backdrop-blur-sm sm:px-6">
      <section
        aria-labelledby="settings-error-title"
        aria-modal="true"
        role="dialog"
        className="relative max-w-md rounded-2xl border border-[#e4e7f0] bg-white p-8 text-center shadow-[0_30px_90px_rgba(17,24,39,0.18)]"
      >
        <CloseSettingsButton onClose={onClose} />
        <h1
          id="settings-error-title"
          className="text-xl font-bold tracking-tight text-[#0b1430]"
        >
          Settings unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#5f6b85]">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-[#10162f] px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#1d2749] focus:outline-none focus:ring-4 focus:ring-[#635bff]/10"
        >
          Retry
        </button>
      </section>
    </main>
  );
}
