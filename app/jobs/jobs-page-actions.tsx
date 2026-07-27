"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../auth-context";
import { getProfile, type ProfileRow } from "@/lib/auth-profiles";
import { canProfileAccessPostJob } from "@/lib/posting-access";
import { supabase } from "@/lib/supabase";
import { logAuthError } from "@/lib/auth-errors";

function useJobsPageProfile() {
  const { isAuthLoading, isLoggedIn, logout } = useAuth();
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

    async function loadProfile(client: NonNullable<typeof supabase>) {
      try {
        const { data, error } = await client.auth.getUser();

        if (error) {
          logAuthError("[jobs-actions] user lookup failed", error);
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
        logAuthError("[jobs-actions] user lookup network failure", error);
      }
    }

    void loadProfile(supabaseClient);

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, isLoggedIn]);

  return {
    isAuthLoading,
    isLoggedIn,
    logout,
    profile,
  };
}

export default function JobsPageActions() {
  const { isAuthLoading, isLoggedIn, profile } = useJobsPageProfile();

  if (isAuthLoading || !isLoggedIn) {
    return null;
  }

  const canPostJob = canProfileAccessPostJob(profile);
  const showPricing =
    profile?.role_mode === "recruiter" && profile.current_plan === "free";

  return (
    <>
      {profile?.role_mode === "job_seeker" ? (
        <Link
          href="/saved-jobs"
          className="hidden h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200 sm:inline-flex"
        >
          Saved Jobs
        </Link>
      ) : null}
      {canPostJob ? (
        <Link
          href="/post-job"
          className="hidden h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_12px_28px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200 sm:inline-flex"
        >
          Post a Job
        </Link>
      ) : showPricing ? (
        <Link
          href="/pricing"
          className="hidden h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200 sm:inline-flex"
        >
          Upgrade
        </Link>
      ) : null}
    </>
  );
}

export function JobsPostJobCta() {
  const { isAuthLoading, isLoggedIn, profile } = useJobsPageProfile();

  if (isAuthLoading || !isLoggedIn) {
    return null;
  }

  if (canProfileAccessPostJob(profile)) {
    return (
      <Link
        href="/post-job"
        className="mt-10 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200 sm:hidden"
      >
        Post a Job
      </Link>
    );
  }

  if (profile?.role_mode === "recruiter" && profile.current_plan === "free") {
    return (
      <Link
        href="/pricing"
        className="mt-10 inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200 sm:hidden"
      >
        Upgrade to Post
      </Link>
    );
  }

  return null;
}
