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
  usesCanvasChrome: boolean;
  isMobileOpen: boolean;
  onDesktopToggle: () => void;
  onMobileClose: () => void;
  onMobileOpen: () => void;
};

const desktopSidebarId = "app-sidebar-desktop";
const mobileSidebarId = "app-sidebar-mobile";

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Home",
  },
  {
    href: "/dashboard",
    label: "Dashboard",
  },
  {
    href: "/jobs",
    label: "Jobs",
  },
  {
    href: "/saved-jobs",
    label: "Saved Jobs",
    requiresCandidate: true,
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
      className="sidebar-lock ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E7E1FF] bg-[#F4F0FF] text-[#7B6BCF]"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <rect height="10" rx="2" stroke="currentColor" strokeWidth="1.8" width="14" x="5" y="10" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    </span>
  );
}

function NavigationIcon({ label }: { label: string }) {
  const paths: Record<string, string> = {
    Home: "M4 10.8 12 4l8 6.8v8.2a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.2Z",
    Dashboard: "M4 5h6v6H4V5Zm10 0h6v6h-6V5ZM4 15h6v4H4v-4Zm10 0h6v4h-6v-4Z",
    Jobs: "M4 8h16v11H4zM8 8V5.5C8 4.7 8.7 4 9.5 4h5c.8 0 1.5.7 1.5 1.5V8M4 12h16M10 12v2h4v-2",
    "Saved Jobs": "M6 4h12v16l-6-3-6 3V4Z",
    "Post Job": "M6 3.5h8l4 4V20H6V3.5Zm8 0V8h4M9 13h6M12 10v6",
    Interviews: "M5 5h14v14H5zM8 3v4M16 3v4M5 9h14M8.5 13h.1m3.4 0h.1m3.4 0h.1",
    Pricing: "m12 3 8 8-9 10-8-8 9-10Zm0 5v6m-3-3h6",
  };

  return (
    <span aria-hidden="true" className="sidebar-nav-icon inline-flex h-6 w-6 shrink-0 items-center justify-center">
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path
          d={paths[label] ?? paths.Dashboard}
          fill={label === "Home" || label === "Dashboard" ? "currentColor" : "none"}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
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

function SidebarDecorations() {
  return (
    <div aria-hidden="true" className="sidebar-decoration-layer">
      <div className="sidebar-peach-atmosphere" />
      <svg className="sidebar-cloud-drawing" fill="none" viewBox="0 0 180 120">
        <path d="M22 78c0-11 9-20 20-20 2-17 17-29 34-29 18 0 32 12 35 29 4-4 9-6 15-6 12 0 22 10 22 22h5c10 0 18 8 18 18H40c-10 0-18-6-18-14Z" />
        <path className="sidebar-bird" d="M99 101c7-7 14-7 21 0m17 11c5-5 10-5 15 0" />
      </svg>
      <svg className="sidebar-bottom-drawing" fill="none" viewBox="0 0 360 120">
        <path className="sidebar-bottom-cloud-left" d="M0 92c22-21 39-17 55-3 18-25 50-21 61 3 19-10 42 1 48 19H0Z" />
        <path className="sidebar-bottom-cloud-right" d="M244 111c8-20 28-28 45-17 9-22 41-24 53-2 8-3 15 0 18 7v21h-116Z" />
        <path className="sidebar-bottom-path" d="M140 119c45-32 75-44 105-43 27 1 48 22 76 18 14-2 26-10 39-20" />
      </svg>
    </div>
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
    <nav aria-label="Primary navigation" className="sidebar-nav grid gap-2">
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
            className={`sidebar-nav-item flex h-11 items-center rounded-xl border-l-4 px-3 text-sm font-semibold transition-all duration-200 ${
              active
                ? "sidebar-nav-item-active border-[#6C3FF2] bg-[#F4F0FF] text-[#5C39D6] shadow-[0_12px_30px_rgba(113,82,232,0.08)]"
                : "border-transparent text-[#14264D] hover:border-transparent hover:bg-[#FAF8FF] hover:text-[#5C39D6]"
            }`}
          >
            <NavigationIcon label={item.label} />
            <span className="sidebar-nav-label">{item.label}</span>
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
        className="sidebar-login-button inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-black px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(17,24,39,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_12px_28px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
      >
        Login
      </Link>
    );
  }

  return <SidebarAccountMenu />;
}

export default function Sidebar({
  isDesktopCollapsed,
  usesCanvasChrome,
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
        className={`sidebar-toggle-button fixed left-3 top-5 z-40 hidden h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-[0_10px_24px_rgba(17,24,39,0.08)] transition-colors duration-200 hover:border-yellow-300 hover:bg-yellow-50/50 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 lg:inline-flex ${usesCanvasChrome ? "home-route-sidebar-toggle" : ""}`}
      >
        <HamburgerIcon />
      </button>

      <aside
        id={desktopSidebarId}
        aria-hidden={isDesktopCollapsed}
        inert={isDesktopCollapsed}
        className={`app-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-gray-200 bg-white px-4 py-5 shadow-[12px_0_40px_rgba(17,24,39,0.04)] lg:flex lg:flex-col ${usesCanvasChrome ? "home-route-sidebar" : ""}`}
      >
        <SidebarDecorations />
        <div className="sidebar-inner">
          <div className="sidebar-menu-area">
            <p className="sidebar-menu-label">MENU</p>
            <SidebarNavigation pathname={pathname} profile={profile} />
          </div>

          <div className="sidebar-profile-area">
            <AuthButton />
          </div>
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
            className="sidebar-mobile-toggle inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-[0_8px_20px_rgba(17,24,39,0.06)] transition-colors duration-200 hover:border-yellow-300 hover:bg-yellow-50/50 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            <HamburgerIcon />
          </button>
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
        className={`sidebar-mobile-drawer fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-3rem))] flex-col border-r border-gray-200 bg-white px-4 py-5 shadow-[18px_0_50px_rgba(17,24,39,0.18)] transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarDecorations />
        <div className="sidebar-mobile-inner">
          <button
            ref={mobileCloseButtonRef}
            type="button"
            aria-label="Close sidebar"
            onClick={() => closeMobileSidebar()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-colors duration-200 hover:border-yellow-300 hover:bg-yellow-50/50 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          >
            <CloseIcon />
          </button>

          <div className="sidebar-mobile-menu min-h-0 flex-1 overflow-y-auto">
            <p className="sidebar-menu-label">MENU</p>
            <SidebarNavigation
              pathname={pathname}
              profile={profile}
              onNavigate={() => closeMobileSidebar()}
            />
          </div>

          <div className="sidebar-profile-area">
            <AuthButton onNavigate={() => closeMobileSidebar()} />
          </div>
        </div>
      </aside>
    </>
  );
}
