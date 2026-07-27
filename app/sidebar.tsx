"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

function AuthButton() {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return (
      <Link
        href="/login"
        className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-black px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(17,24,39,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_12px_28px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
      >
        Login
      </Link>
    );
  }

  return <SidebarAccountMenu />;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { isAuthLoading, isLoggedIn } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);

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

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-gray-200 bg-white px-4 py-6 shadow-[12px_0_40px_rgba(17,24,39,0.04)] lg:flex lg:flex-col">
        <Link href="/" className="flex items-center gap-3 px-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-sm font-bold text-white shadow-[0_12px_28px_rgba(17,24,39,0.18)]">
            JB
          </span>
          <span className="text-lg font-bold tracking-tight text-gray-900">
            Job Board
          </span>
        </Link>

        <nav className="mt-10 grid gap-2">
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
                aria-label={locked ? `${item.label} locked` : item.label}
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

        <div className="mt-auto flex items-center gap-2 px-3 pt-6">
          <AuthButton />
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 shadow-[0_12px_30px_rgba(17,24,39,0.04)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-xs font-bold text-white shadow-[0_10px_24px_rgba(17,24,39,0.16)]">
              JB
            </span>
            <span className="text-base font-bold tracking-tight text-gray-900">
              Job Board
            </span>
          </Link>

          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <SidebarAccountMenu compact placement="bottom" />
            </div>
          ) : null}
        </div>

        <nav className="mx-auto mt-3 flex max-w-6xl min-w-0 items-center gap-2 overflow-x-auto">
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
                aria-label={locked ? `${item.label} locked` : item.label}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                  active
                      ? "border-yellow-500 bg-yellow-50 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-yellow-200 hover:bg-yellow-50/50 hover:text-gray-900"
                }`}
              >
                {item.label}
                {locked ? <LockIcon /> : null}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
