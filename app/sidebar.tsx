"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-context";
import { dashboardProfileChangedEvent } from "./dashboard/use-dashboard-data";
import SidebarAccountMenu from "./sidebar-account-menu";
import { getProfile, type ProfileRow } from "@/lib/auth-profiles";
import { canProfileAccessPostJob } from "@/lib/posting-access";
import { supabase } from "@/lib/supabase";
import { logAuthError } from "@/lib/auth-errors";

type NavItem = {
  href: string;
  label: string;
  requiresCandidate?: boolean;
  requiresPostingAccess?: boolean;
  requiresRecruiter?: boolean;
};

type SidebarProps = {
  isDesktopCollapsed: boolean;
  isMobileOpen: boolean;
  onDesktopToggle: () => void;
  onMobileClose: () => void;
  onMobileOpen: () => void;
};

const desktopSidebarId = "app-sidebar-desktop";
const mobileSidebarId = "app-sidebar-mobile";

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
  },
  {
    href: "/jobs",
    label: "Jobs",
  },
  {
    href: "/post-job",
    label: "Post Job",
    requiresPostingAccess: true,
    requiresRecruiter: true,
  },
  {
    href: "/interviews",
    label: "Interviews",
    requiresRecruiter: true,
  },
  {
    href: "/pricing",
    label: "Pricing",
  },
];

function isActiveRoute(pathname: string, href: string) {
  const routeHref = href.split("#", 1)[0];

  if (routeHref === "/dashboard") {
    return pathname === routeHref;
  }

  return pathname === routeHref || pathname.startsWith(`${routeHref}/`);
}

function LockIcon() {
  return (
    <span
      aria-hidden="true"
      className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white/70 text-gray-400 backdrop-blur"
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24">
        <rect height="10" rx="2" stroke="currentColor" strokeWidth="2" width="14" x="5" y="10" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    </span>
  );
}

function HamburgerIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function SidebarNavigation({
  onNavigate,
  pathname,
  profile,
}: {
  onNavigate?: () => void;
  pathname: string;
  profile: ProfileRow | null;
}) {
  return (
    <nav aria-label="Primary navigation" className="grid gap-2">
      {navItems.map((item) => {
        if (item.requiresRecruiter && profile?.role_mode !== "recruiter") {
          return null;
        }

        if (item.requiresCandidate && profile?.role_mode !== "job_seeker") {
          return null;
        }

        const active = isActiveRoute(pathname, item.href);
        const locked =
          Boolean(item.requiresPostingAccess) &&
          !canProfileAccessPostJob(profile);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={locked ? `${item.label} locked` : item.label}
            onClick={onNavigate}
            className={`flex h-11 items-center rounded-xl border-l-4 px-3 text-sm font-semibold transition-all duration-200 ${
              active
                ? "border-yellow-500 bg-gray-50 text-gray-900 shadow-[0_10px_24px_rgba(17,24,39,0.05)]"
                : "border-transparent text-gray-500 hover:border-yellow-200 hover:bg-yellow-50/50 hover:text-gray-900"
            }`}
          >
            {item.label}
            {locked ? <LockIcon /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function AuthButton({ onNavigate }: { onNavigate?: () => void }) {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return (
      <Link
        href="/login"
        onClick={onNavigate}
        className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-black px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(17,24,39,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_12px_28px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
      >
        Login
      </Link>
    );
  }

  return <SidebarAccountMenu />;
}

export default function Sidebar({
  isDesktopCollapsed,
  isMobileOpen,
  onDesktopToggle,
  onMobileClose,
  onMobileOpen,
}: SidebarProps) {
  const pathname = usePathname();
  const { isAuthLoading, isLoggedIn } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileDrawerRef = useRef<HTMLElement | null>(null);
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
  const shouldRestoreMobileFocusRef = useRef(false);

  const closeMobileSidebar = useCallback(
    (restoreFocus = true) => {
      shouldRestoreMobileFocusRef.current = restoreFocus;
      onMobileClose();
    },
    [onMobileClose],
  );

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    const supabaseClient = supabase;

    if (!isLoggedIn || !supabaseClient) {
      const clearProfileId = window.setTimeout(() => {
        setProfile(null);
      }, 0);

      return () => {
        window.clearTimeout(clearProfileId);
      };
    }

    let isMounted = true;

    async function loadSidebarProfile(client: NonNullable<typeof supabase>) {
      try {
        const { data, error } = await client.auth.getUser();

        if (error) {
          logAuthError("[sidebar] user lookup failed", error);
          return;
        }

        if (!isMounted || !data.user) {
          return;
        }

        const result = await getProfile(data.user.id);

        if (isMounted) {
          setProfile(result.profile);
        }
      } catch (error) {
        logAuthError("[sidebar] user lookup network failure", error);
      }
    }

    void loadSidebarProfile(supabaseClient);

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, isLoggedIn, pathname]);

  useEffect(() => {
    function handleProfileChanged(event: Event) {
      const nextProfile = (
        event as CustomEvent<{ profile?: ProfileRow }>
      ).detail?.profile;

      if (nextProfile) {
        setProfile(nextProfile);
      }
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
    onMobileClose();
  }, [onMobileClose, pathname]);

  useEffect(() => {
    if (isMobileOpen || !shouldRestoreMobileFocusRef.current) {
      return;
    }

    const focusId = window.requestAnimationFrame(() => {
      shouldRestoreMobileFocusRef.current = false;
      mobileToggleRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusId);
    };
  }, [isMobileOpen]);

  useEffect(() => {
    const desktopMediaQuery = window.matchMedia("(min-width: 1024px)");

    function handleDesktopChange(event: MediaQueryListEvent) {
      if (event.matches) {
        onMobileClose();
      }
    }

    if (desktopMediaQuery.matches) {
      onMobileClose();
    }

    desktopMediaQuery.addEventListener("change", handleDesktopChange);

    return () => {
      desktopMediaQuery.removeEventListener("change", handleDesktopChange);
    };
  }, [onMobileClose]);

  useEffect(() => {
    if (!isMobileOpen) {
      return;
    }

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const focusId = window.requestAnimationFrame(() => {
      mobileCloseButtonRef.current?.focus();
    });

    body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    function getFocusableElements() {
      return Array.from(
        mobileDrawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter(
        (element) =>
          element.getAttribute("aria-hidden") !== "true" &&
          element.offsetParent !== null,
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        const nestedPopup = mobileDrawerRef.current?.querySelector(
          '[role="menu"], [role="dialog"]',
        );

        if (nestedPopup) {
          return;
        }

        event.preventDefault();
        closeMobileSidebar();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();

      if (!focusableElements.length) {
        event.preventDefault();
        mobileDrawerRef.current?.focus();
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
      window.cancelAnimationFrame(focusId);
      document.removeEventListener("keydown", handleKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [closeMobileSidebar, isMobileOpen]);

  return (
    <>
      <button
        type="button"
        aria-controls={desktopSidebarId}
        aria-expanded={!isDesktopCollapsed}
        aria-label={isDesktopCollapsed ? "Open sidebar" : "Close sidebar"}
        title={isDesktopCollapsed ? "Open sidebar" : "Close sidebar"}
        onClick={onDesktopToggle}
        className="fixed left-3 top-5 z-40 hidden h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-[0_10px_24px_rgba(17,24,39,0.08)] transition-colors duration-200 hover:border-yellow-300 hover:bg-yellow-50/50 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 lg:inline-flex"
      >
        <HamburgerIcon />
      </button>

      <aside
        id={desktopSidebarId}
        aria-hidden={isDesktopCollapsed}
        inert={isDesktopCollapsed}
        className="app-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-gray-200 bg-white px-4 py-5 shadow-[12px_0_40px_rgba(17,24,39,0.04)] lg:flex lg:flex-col"
      >
        <Link href="/" className="flex h-16 items-center pl-12 pr-1">
          <img
            alt="JobForge"
            className="h-14 max-w-full object-contain dark:hidden"
            height={56}
            src="/brand/jobforge-sidebar-logo-light.svg"
            width={172}
          />
          <img
            alt=""
            aria-hidden="true"
            className="hidden h-14 max-w-full object-contain dark:block"
            height={56}
            src="/brand/jobforge-sidebar-logo-transparent.svg"
            width={172}
          />
        </Link>

        <div className="mt-6">
          <SidebarNavigation pathname={pathname} profile={profile} />
        </div>

        <div className="mt-auto flex items-center gap-2 px-3 pt-6">
          <AuthButton />
        </div>
      </aside>

      <header
        aria-hidden={isMobileOpen}
        inert={isMobileOpen}
        className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 shadow-[0_12px_30px_rgba(17,24,39,0.04)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-3">
          <button
            ref={mobileToggleRef}
            type="button"
            aria-controls={mobileSidebarId}
            aria-expanded={isMobileOpen}
            aria-label="Open sidebar"
            onClick={onMobileOpen}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-[0_8px_20px_rgba(17,24,39,0.06)] transition-colors duration-200 hover:border-yellow-300 hover:bg-yellow-50/50 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            <HamburgerIcon />
          </button>

          <Link href="/" className="flex h-12 items-center">
            <img
              alt="JobForge"
              className="h-11 w-auto dark:hidden"
              height={44}
              src="/brand/jobforge-sidebar-logo-light.svg"
              width={135}
            />
            <img
              alt=""
              aria-hidden="true"
              className="hidden h-11 w-auto dark:block"
              height={44}
              src="/brand/jobforge-sidebar-logo-transparent.svg"
              width={135}
            />
          </Link>
        </div>
      </header>

      <div
        aria-hidden="true"
        onClick={() => closeMobileSidebar()}
        className={`fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] transition-opacity duration-300 lg:hidden ${
          isMobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        ref={mobileDrawerRef}
        id={mobileSidebarId}
        role="dialog"
        aria-modal="true"
        aria-label="Primary navigation"
        aria-hidden={!isMobileOpen}
        inert={!isMobileOpen}
        tabIndex={-1}
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-3rem))] flex-col border-r border-gray-200 bg-white px-4 py-5 shadow-[18px_0_50px_rgba(17,24,39,0.18)] transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between gap-3">
          <Link
            href="/"
            onClick={() => closeMobileSidebar()}
            className="flex min-w-0 items-center"
          >
            <img
              alt="JobForge"
              className="h-12 max-w-full object-contain dark:hidden"
              height={48}
              src="/brand/jobforge-sidebar-logo-light.svg"
              width={148}
            />
            <img
              alt=""
              aria-hidden="true"
              className="hidden h-12 max-w-full object-contain dark:block"
              height={48}
              src="/brand/jobforge-sidebar-logo-transparent.svg"
              width={148}
            />
          </Link>

          <button
            ref={mobileCloseButtonRef}
            type="button"
            aria-label="Close sidebar"
            onClick={() => closeMobileSidebar()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-colors duration-200 hover:border-yellow-300 hover:bg-yellow-50/50 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-7 min-h-0 flex-1 overflow-y-auto pb-4">
          <SidebarNavigation
            pathname={pathname}
            profile={profile}
            onNavigate={() => closeMobileSidebar()}
          />
        </div>

        <div className="border-t border-gray-200 px-3 pt-5">
          <AuthButton onNavigate={() => closeMobileSidebar()} />
        </div>
      </aside>
    </>
  );
}
