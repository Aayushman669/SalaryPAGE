"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/auth-context";
import { getProfile, type ProfileRow } from "@/lib/auth-profiles";
import { supabase } from "@/lib/supabase";
const CandidateApplications = dynamic(() => import("./candidate-applications"), {
  loading: () => <ApplicationsLoading />,
});
const RecruiterApplications = dynamic(
  () => import("./recruiter-applications"),
  { loading: () => <ApplicationsLoading /> },
);

function ApplicationsLoading() {
  return (
    <main className="ui-consistency-surface min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <section className="mx-auto w-full max-w-6xl">
        <div className="h-5 w-36 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-5 h-12 w-72 max-w-full animate-pulse rounded-xl bg-gray-100" />
        <div className="mt-10 grid gap-4">
          {[0, 1, 2].map((item) => (
            <div
              aria-hidden="true"
              className="h-36 animate-pulse rounded-2xl border border-gray-200 bg-white"
              key={item}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function ApplicationsError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <main className="ui-consistency-surface min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <section className="mx-auto w-full max-w-5xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
          <h1 className="text-lg font-bold text-gray-900">
            Applications unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-500">{message}</p>
          {onRetry ? (
            <button
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-yellow-200"
              onClick={onRetry}
              type="button"
            >
              Retry
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function ApplicationsPage() {
  const { isAuthLoading, isLoggedIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (isAuthLoading || !isLoggedIn) {
      return;
    }

    if (!supabase) {
      const errorId = window.setTimeout(() => {
        setError(
          "Supabase is not configured. Please check your environment variables.",
        );
        setIsLoading(false);
      }, 0);

      return () => window.clearTimeout(errorId);
    }

    let isMounted = true;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);

      try {
        const { data: userData, error: userError } =
          await supabase!.auth.getUser();

        if (userError || !userData.user) {
          if (process.env.NODE_ENV === "development") {
            console.error("[applications] user lookup failed", userError);
          }

          if (isMounted) {
            setError("Please log in again to view your applications.");
          }

          return;
        }

        const profileResult = await getProfile(userData.user.id);

        if (!isMounted) {
          return;
        }

        if (profileResult.error || !profileResult.profile) {
          if (process.env.NODE_ENV === "development") {
            console.error(
              "[applications] profile lookup failed",
              profileResult.error,
            );
          }

          setError(
            "We could not load your profile. Please refresh and try again.",
          );
          return;
        }

        setProfile(profileResult.profile);
      } catch (loadError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[applications] profile network failure", loadError);
        }

        if (isMounted) {
          setError(
            "We could not connect. Please check your internet connection and try again.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, isLoggedIn, retryNonce]);

  if (isAuthLoading || isLoading) {
    return <ApplicationsLoading />;
  }

  if (error) {
    return <ApplicationsError message={error} onRetry={() => setRetryNonce((current) => current + 1)} />;
  }

  if (profile?.role_mode === "recruiter") {
    return <RecruiterApplications profile={profile} />;
  }

  if (profile?.role_mode === "job_seeker") {
    return <CandidateApplications />;
  }

  return (
    <ApplicationsError message="Complete onboarding before viewing applications." />
  );
}
