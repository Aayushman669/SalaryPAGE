"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-context";
import { useThemePreference } from "./theme/use-theme-preference";
import {
  ensureProfile,
  getProfile,
  updateProfileRole,
  type ProfileRole,
  type ProfileRow,
} from "@/lib/auth-profiles";
import { logAuthError } from "@/lib/auth-errors";
import {
  formatPlan,
  getRoleLabel,
  isValidRole,
  normalizeDashboardProfile,
  normalizePlan,
} from "@/lib/dashboard-data";
import { supabase } from "@/lib/supabase";
import { themeLabels, themePreferences } from "@/lib/theme";
import type { ThemePreference } from "@/lib/theme";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import {
  clearDashboardProfileCache,
  dashboardProfileChangedEvent,
  notifyDashboardProfileChanged,
} from "./dashboard/use-dashboard-data";

type SidebarAccountMenuProps = {
  compact?: boolean;
  placement?: "top" | "bottom";
};

type AccountUser = {
  email: string | null;
  fullName: string;
  id: string;
};

const roleSwitchOptions = [
  {
    description: "Browse and apply for jobs",
    id: "job_seeker",
    title: "Job Seeker",
  },
  {
    description: "Post jobs and manage hiring",
    id: "recruiter",
    title: "Recruiter",
  },
] satisfies Array<{
  description: string;
  id: ProfileRole;
  title: string;
}>;

function readMetadataName(metadata: Record<string, unknown> | undefined) {
  return typeof metadata?.full_name === "string" ? metadata.full_name : "";
}

function getDisplayName(profile: ProfileRow | null, accountUser: AccountUser | null) {
  return (
    profile?.full_name?.trim() ||
    accountUser?.fullName.trim() ||
    accountUser?.email ||
    "Account"
  );
}

function getAccountInitial(displayName: string, email: string | null | undefined) {
  const source = displayName !== "Account" ? displayName : email ?? "Account";
  const parts = source
    .split(/[ @._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return (parts[0]?.slice(0, 2) ?? "AC").toUpperCase();
}

function MenuIcon({ label }: { label: string }) {
  const iconPaths: Record<string, string> = {
    L: "M10 7 5 12l5 5M5 12h10M14 5l5 7-5 7",
    P: "M4 7h16v10H4zM4 10h16",
    R: "M9 6V4h6v2M4 8h16v10H4zM4 12h16",
    S: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM12 4v2M12 18v2M4 12h2M18 12h2",
    T: "M6 5h12v14H6zM9 8h6M9 12h6M9 16h3",
  };

  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-700"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
        <path
          d={iconPaths[label] ?? "M12 5v14M5 12h14"}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}

export default function SidebarAccountMenu({
  compact = false,
  placement = "top",
}: SidebarAccountMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthLoading, isLoggedIn, logout } = useAuth();
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [selectedRole, setSelectedRole] = useState<ProfileRole | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const roleCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const roleDialogRef = useRef<HTMLDivElement | null>(null);
  const roleOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const roleSwitchButtonRef = useRef<HTMLButtonElement | null>(null);
  const themeButtonRef = useRef<HTMLButtonElement | null>(null);
  const themeOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { isMounted, preference, setPreference } = useThemePreference({
    userId: profile?.id,
  });

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    const supabaseClient = supabase;

    if (!isLoggedIn || !supabaseClient) {
      const clearAccountId = window.setTimeout(() => {
        setAccountUser(null);
        setProfile(null);
        setIsProfileLoading(false);
      }, 0);

      return () => {
        window.clearTimeout(clearAccountId);
      };
    }

    let isMountedEffect = true;

    async function loadAccountProfile(client: NonNullable<typeof supabase>) {
      setIsProfileLoading(true);

      try {
        const { data, error } = await client.auth.getUser();

        if (!isMountedEffect) {
          return;
        }

        if (error) {
          logAuthError("[account-menu] user lookup failed", error);
          setAccountUser(null);
          setProfile(null);
          setIsProfileLoading(false);
          return;
        }

        if (!data.user) {
          setAccountUser(null);
          setProfile(null);
          setIsProfileLoading(false);
          return;
        }

        const nextUser = {
          email: data.user.email ?? null,
          fullName: readMetadataName(data.user.user_metadata),
          id: data.user.id,
        };

        setAccountUser(nextUser);

        const profileResult = await getProfile(data.user.id);

        if (!isMountedEffect) {
          return;
        }

        if (profileResult.error) {
          logAuthError("[account-menu] profile lookup failed", profileResult.error);
          setProfile(null);
        } else {
          setProfile(profileResult.profile);
        }

        setIsProfileLoading(false);
      } catch (error) {
        logAuthError("[account-menu] profile lookup network failure", error);

        if (!isMountedEffect) {
          return;
        }

        setAccountUser(null);
        setProfile(null);
        setIsProfileLoading(false);
      }
    }

    void loadAccountProfile(supabaseClient);

    return () => {
      isMountedEffect = false;
    };
  }, [isAuthLoading, isLoggedIn]);

  useEffect(() => {
    function handleProfileChanged(event: Event) {
      const nextProfile = (
        event as CustomEvent<{ profile?: ProfileRow }>
      ).detail?.profile;

      if (!nextProfile) {
        return;
      }

      setProfile((currentProfile) => {
        if (
          currentProfile &&
          currentProfile.id !== nextProfile.id
        ) {
          return currentProfile;
        }

        return nextProfile;
      });
    }

    window.addEventListener(dashboardProfileChangedEvent, handleProfileChanged);

    return () => {
      window.removeEventListener(
        dashboardProfileChangedEvent,
        handleProfileChanged,
      );
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setIsThemeMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (isThemeMenuOpen) {
          event.preventDefault();
          setIsThemeMenuOpen(false);
          themeButtonRef.current?.focus();
          return;
        }

        setIsOpen(false);
        setIsThemeMenuOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isThemeMenuOpen]);

  const closeAccountMenu = useCallback(() => {
    setIsOpen(false);
    setIsThemeMenuOpen(false);
  }, []);

  const closeRoleModal = useCallback(() => {
    if (isSwitchingRole) {
      return;
    }

    setIsRoleModalOpen(false);
    setSelectedRole(null);
    buttonRef.current?.focus();
  }, [isSwitchingRole]);

  useEffect(() => {
    if (!isRoleModalOpen) {
      return;
    }

    const focusId = window.setTimeout(() => {
      const selectedIndex = roleSwitchOptions.findIndex(
        (option) => option.id === selectedRole,
      );
      const focusTarget =
        roleOptionRefs.current[selectedIndex >= 0 ? selectedIndex : 0] ??
        roleCloseButtonRef.current;

      focusTarget?.focus();
    }, 0);

    function getFocusableElements() {
      return Array.from(
        roleDialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.getAttribute("aria-hidden"));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRoleModal();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();

      if (!focusableElements.length) {
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
    };
  }, [closeRoleModal, isRoleModalOpen, selectedRole]);

  const rememberSettingsReturnPath = useCallback(() => {
    if (typeof window === "undefined" || pathname.startsWith("/settings")) {
      return;
    }

    window.sessionStorage.setItem(
      "job_board_settings_return_path",
      `${window.location.pathname}${window.location.search}`,
    );
  }, [pathname]);

  const handleLogout = useCallback(() => {
    closeAccountMenu();
    setAccountUser(null);
    setProfile(null);
    clearDashboardProfileCache();
    void logout();
  }, [closeAccountMenu, logout]);

  const openRoleModal = useCallback(() => {
    const currentRole =
      profile && isValidRole(profile.role_mode) ? profile.role_mode : null;

    setSelectedRole(currentRole ?? "job_seeker");
    setIsThemeMenuOpen(false);
    setIsOpen(false);
    setIsRoleModalOpen(true);
  }, [profile]);

  const handleRoleOptionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight"
      ) {
        return;
      }

      event.preventDefault();

      const nextIndex =
        event.key === "ArrowDown" || event.key === "ArrowRight"
          ? (index + 1) % roleSwitchOptions.length
          : (index - 1 + roleSwitchOptions.length) % roleSwitchOptions.length;

      const nextRole = roleSwitchOptions[nextIndex].id;

      setSelectedRole(nextRole);
      roleOptionRefs.current[nextIndex]?.focus();
    },
    [],
  );

  const handleSwitchRole = useCallback(async () => {
    if (isSwitchingRole || !selectedRole) {
      return;
    }

    const previousProfile = profile;

    setIsSwitchingRole(true);

    if (!supabase) {
      setIsSwitchingRole(false);
      showErrorToast(
        "We could not switch your role. Supabase is not configured.",
      );
      return;
    }

    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        logAuthError("[account-menu] role switch user lookup failed", error);
      }

      if (error || !data.user) {
        setIsSwitchingRole(false);
        setProfile(previousProfile);
        showErrorToast("Please log in again to switch roles.");
        router.replace("/login");
        return;
      }

      const profileCreationError = await ensureProfile({
        email: data.user.email ?? "",
        fullName: readMetadataName(data.user.user_metadata),
        userId: data.user.id,
      });

      if (profileCreationError) {
        setIsSwitchingRole(false);
        setProfile(previousProfile);
        showErrorToast(
          "We could not prepare your profile. Please try again.",
        );
        return;
      }

      const roleUpdateResult = await updateProfileRole({
        role: selectedRole,
        userId: data.user.id,
      });

      if (roleUpdateResult.error || !roleUpdateResult.profile) {
        setIsSwitchingRole(false);
        setProfile(previousProfile);
        showErrorToast(
          roleUpdateResult.error ??
            "We could not switch your role. Please try again.",
        );
        return;
      }

      const nextProfile = roleUpdateResult.profile;
      const normalizedProfile = normalizeDashboardProfile(nextProfile);

      setProfile(nextProfile);

      if (normalizedProfile) {
        notifyDashboardProfileChanged(normalizedProfile);
      } else {
        clearDashboardProfileCache();
      }

      setIsSwitchingRole(false);
      setIsRoleModalOpen(false);
      setSelectedRole(null);
      showSuccessToast(
        selectedRole === "recruiter"
          ? "Switched to Recruiter"
          : "Switched to Job Seeker",
      );

      router.replace(
        nextProfile.profile_completed === true ? "/dashboard" : "/onboarding",
      );
    } catch (error) {
      logAuthError("[account-menu] role switch failed", error);
      setIsSwitchingRole(false);
      setProfile(previousProfile);
      showErrorToast("We could not switch your role. Please try again.");
    }
  }, [isSwitchingRole, profile, router, selectedRole]);

  const handleThemeOptionKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key === "Escape" || event.key === "ArrowLeft") {
        event.preventDefault();
        setIsThemeMenuOpen(false);
        themeButtonRef.current?.focus();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }

      event.preventDefault();

      const nextIndex =
        event.key === "ArrowDown"
          ? (index + 1) % themePreferences.length
          : (index - 1 + themePreferences.length) % themePreferences.length;

      themeOptionRefs.current[nextIndex]?.focus();
    },
    [],
  );

  if (isAuthLoading || !isLoggedIn) {
    return null;
  }

  const displayName = getDisplayName(profile, accountUser);
  const email = profile?.email || accountUser?.email || "";
  const currentPlan = normalizePlan(profile?.current_plan ?? null);
  const planLabel = formatPlan(currentPlan);
  const currentRole =
    profile && isValidRole(profile.role_mode) ? profile.role_mode : null;
  const roleLabel =
    currentRole
      ? getRoleLabel(currentRole)
      : "Profile setup";
  const initial = getAccountInitial(displayName, email);
  const panelPosition =
    placement === "top"
      ? "bottom-full left-0 mb-3"
      : "right-0 top-full mt-3";
  const activeThemeLabel = isMounted ? themeLabels[preference] : "Light";
  const isSwitchButtonDisabled =
    !selectedRole || isSwitchingRole || selectedRole === currentRole;

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => {
          setIsThemeMenuOpen(false);
          setIsOpen((current) => !current);
        }}
        className={`flex h-11 min-w-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 text-left shadow-[0_10px_22px_rgba(17,24,39,0.05)] transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/50 hover:shadow-[0_14px_28px_rgba(17,24,39,0.08)] focus:outline-none focus:ring-4 focus:ring-yellow-200 ${
          compact ? "max-w-[170px]" : "w-full"
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-[10px] font-black text-white shadow-[0_8px_18px_rgba(17,24,39,0.14)]">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-gray-900">
            {isProfileLoading ? "Loading..." : displayName}
          </span>
          <span className="block truncate text-[11px] font-medium text-gray-500">
            {planLabel} plan
          </span>
        </span>
        <svg
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Account menu"
          className={`absolute z-50 w-[min(17rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-2 shadow-[0_18px_50px_rgba(17,24,39,0.14)] ${panelPosition}`}
        >
          <div className="px-2 pb-2 pt-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-[11px] font-black text-white">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-5 text-gray-900">
                  {displayName}
                </p>
                {email ? (
                  <p className="truncate text-[11px] font-medium leading-4 text-gray-500">
                    {email}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex max-w-full items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                {roleLabel}
              </span>
              <span className="inline-flex max-w-full items-center rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-gray-900">
                {planLabel} Plan
              </span>
            </div>
          </div>

          <div className="relative border-y border-gray-100 py-1.5">
            <button
              ref={themeButtonRef}
              type="button"
              role="menuitem"
              aria-expanded={isThemeMenuOpen}
              aria-haspopup="menu"
              disabled={!isMounted}
              onClick={() => setIsThemeMenuOpen((current) => !current)}
              className="flex h-10 w-full items-center gap-2 rounded-xl px-2 text-xs font-semibold text-gray-800 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MenuIcon label="T" />
              <span>Theme</span>
              <span className="ml-auto text-[11px] font-semibold text-gray-500">
                {activeThemeLabel}
              </span>
              <svg
                aria-hidden="true"
                className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${
                  isThemeMenuOpen ? "rotate-90" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>

            {isThemeMenuOpen ? (
              <div
                role="menu"
                aria-label="Theme preference"
                className="absolute left-2 right-2 top-12 z-10 rounded-xl border border-gray-200 bg-white p-1 shadow-[0_14px_34px_rgba(17,24,39,0.14)]"
              >
                {themePreferences.map((themePreference, index) => {
                  const selected = preference === themePreference;

                  return (
                    <button
                      key={themePreference}
                      ref={(element) => {
                        themeOptionRefs.current[index] = element;
                      }}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onKeyDown={(event) =>
                        handleThemeOptionKeyDown(event, index)
                      }
                      onClick={() => {
                        void setPreference(themePreference as ThemePreference);
                        setIsThemeMenuOpen(false);
                        themeButtonRef.current?.focus();
                      }}
                      className={`flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-yellow-200 ${
                        selected
                          ? "bg-yellow-50 text-gray-900"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${
                          selected ? "bg-yellow-500" : "bg-transparent"
                        }`}
                      />
                      <span>{themeLabels[themePreference]}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="grid gap-1 pt-1.5">
            {profile ? (
              <button
                type="button"
                role="menuitem"
                onClick={openRoleModal}
                className="flex h-10 w-full items-center gap-2 rounded-xl px-2 text-xs font-semibold text-gray-800 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-yellow-200"
              >
                <MenuIcon label="R" />
                <span>Switch Role</span>
              </button>
            ) : null}
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => {
                rememberSettingsReturnPath();
                closeAccountMenu();
              }}
              className="flex h-10 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-gray-800 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-yellow-200"
            >
              <MenuIcon label="S" />
              <span>Settings</span>
            </Link>
            <Link
              href="/pricing"
              role="menuitem"
              onClick={closeAccountMenu}
              className="flex h-10 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-gray-800 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-yellow-200"
            >
              <MenuIcon label="P" />
              <span>Plans</span>
              <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                {planLabel}
              </span>
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex h-10 w-full items-center gap-2 rounded-xl px-2 text-xs font-semibold text-gray-800 transition-all duration-200 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-yellow-200"
            >
              <MenuIcon label="L" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      ) : null}

      {isRoleModalOpen ? (
        <div
          aria-labelledby="role-switch-title"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/30 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRoleModal();
            }
          }}
          role="dialog"
        >
          <div
            ref={roleDialogRef}
            className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-3 shadow-[0_24px_70px_rgba(17,24,39,0.20)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-1 pb-2">
              <div>
                <p
                  id="role-switch-title"
                  className="text-sm font-bold text-gray-900"
                >
                  Switch Role
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Choose how you want to use Job Board.
                </p>
              </div>
              <button
                ref={roleCloseButtonRef}
                type="button"
                aria-label="Close role switch"
                disabled={isSwitchingRole}
                onClick={closeRoleModal}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-500 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                x
              </button>
            </div>

            <div className="grid gap-2 py-2" role="radiogroup">
              {roleSwitchOptions.map((option, index) => {
                const isCurrent = currentRole === option.id;
                const isSelected = selectedRole === option.id;

                return (
                  <button
                    key={option.id}
                    ref={(element) => {
                      roleOptionRefs.current[index] = element;
                    }}
                    type="button"
                    aria-checked={isSelected}
                    onClick={() => setSelectedRole(option.id)}
                    onKeyDown={(event) =>
                      handleRoleOptionKeyDown(event, index)
                    }
                    role="radio"
                    className={`rounded-xl border px-3 py-3 text-left transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-yellow-200 ${
                      isSelected
                        ? "border-yellow-400 bg-yellow-50 shadow-[0_12px_28px_rgba(234,179,8,0.12)]"
                        : "border-gray-200 bg-white hover:border-yellow-300 hover:bg-yellow-50/50"
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${
                          isSelected
                            ? "bg-yellow-500 text-gray-900"
                            : "bg-gray-900 text-white"
                        }`}
                      >
                        {option.title.charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">
                            {option.title}
                          </span>
                          {isCurrent ? (
                            <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-900">
                              Current
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-gray-500">
                          {option.description}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                disabled={isSwitchingRole}
                onClick={closeRoleModal}
                className="h-10 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                ref={roleSwitchButtonRef}
                type="button"
                disabled={isSwitchButtonDisabled}
                onClick={handleSwitchRole}
                className="h-10 flex-1 rounded-xl bg-black px-3 text-xs font-semibold text-white transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
              >
                {isSwitchingRole ? "Switching..." : "Switch"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
