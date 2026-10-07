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
          className="jobs-page-action hidden sm:inline-flex"
        >
          Saved Jobs
        </Link>
      ) : null}
      {canPostJob ? (
        <Link
          href="/post-job"
          className="jobs-page-action jobs-page-action-solid hidden sm:inline-flex"
        >
          Post a Job
        </Link>
      ) : showPricing ? (
        <Link
          href="/pricing"
          className="jobs-page-action jobs-page-action-upgrade hidden sm:inline-flex"
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
        className="jobs-page-action jobs-page-action-solid mt-10 inline-flex sm:hidden"
      >
        Post a Job
      </Link>
    );
  }

  if (profile?.role_mode === "recruiter" && profile.current_plan === "free") {
    return (
      <Link
        href="/pricing"
        className="jobs-page-action mt-10 inline-flex sm:hidden"
      >
        Upgrade to Post
      </Link>
    );
  }

  return null;
}
