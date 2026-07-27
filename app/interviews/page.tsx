"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/auth-context";
import { getProfile, type ProfileRow } from "@/lib/auth-profiles";
import { supabase } from "@/lib/supabase";
import RecruiterInterviews from "./recruiter-interviews";

function LoadingState() {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <section className="mx-auto w-full max-w-6xl">
        <div className="h-5 w-40 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-5 h-12 w-80 max-w-full animate-pulse rounded-xl bg-gray-100" />
        <div className="mt-10 h-64 animate-pulse rounded-2xl border border-gray-200 bg-white" />
      </section>
    </main>
  );
}

function AccessState({ message, showLogin = false }: { message: string; showLogin?: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Interviews</p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">Interviews unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">{message}</p>
        {showLogin ? (
          <Link className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200" href="/login">Log in</Link>
        ) : null}
      </section>
    </main>
  );
}

export default function InterviewsPage() {
  const { isAuthLoading, isLoggedIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    if (isAuthLoading || !isLoggedIn) {
      return;
    }
    if (!supabase) {
      const errorId = window.setTimeout(() => {
        setIsLoading(false);
        setError("Supabase is not configured. Please check your environment variables.");
      }, 0);

      return () => window.clearTimeout(errorId);
    }

    let mounted = true;
    async function loadProfile() {
      try {
        const { data, error: userError } = await supabase!.auth.getUser();
        if (userError || !data.user) throw userError ?? new Error("session");
        const result = await getProfile(data.user.id);
        if (!mounted) return;
        if (result.error || !result.profile) {
          setError("We could not load your recruiter profile. Please try again.");
          return;
        }
        setProfile(result.profile);
      } catch (loadError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[interviews] profile load failed", loadError);
        }
        if (mounted) setError("Please log in again to manage recruiter interviews.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void loadProfile();
    return () => {
      mounted = false;
    };
  }, [isAuthLoading, isLoggedIn]);

  if (isAuthLoading) return <LoadingState />;
  if (!isLoggedIn) {
    return <AccessState message="Please log in to manage recruiter interviews." showLogin />;
  }
  if (isLoading) return <LoadingState />;
  if (error) return <AccessState message={error} />;
  if (profile?.role_mode !== "recruiter") {
    return <AccessState message="Only authenticated recruiters can manage interviews." />;
  }

  return <RecruiterInterviews profile={profile} />;
}
