"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/app/auth-context";
import { getProfile } from "@/lib/auth-profiles";
import {
  getFriendlySavedJobActionError,
} from "@/lib/saved-jobs";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

export const savedJobChangedEvent = "job-board:saved-job-changed";

type SavedJobsState = {
  isAuthReady: boolean;
  isCandidate: boolean;
  isLoggedIn: boolean;
  isSaved: (jobSlug: string) => boolean;
  isUpdating: (jobSlug: string) => boolean;
  toggleSaved: (jobSlug: string, jobTitle: string) => Promise<void>;
};

const SavedJobsStateContext = createContext<SavedJobsState | null>(null);

function normalizeSlugs(slugs: string[]) {
  return Array.from(
    new Set(slugs.map((slug) => slug.trim()).filter(Boolean)),
  );
}

function readSavedJobSlugs(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return normalizeSlugs(
    data.flatMap((row) => {
      if (!row || typeof row !== "object") {
        return [];
      }

      const slug = (row as { job_slug?: unknown }).job_slug;

      return typeof slug === "string" ? [slug] : [];
    }),
  );
}

export function SavedJobsProvider({
  children,
  initialSavedSlugs,
  jobSlugs,
}: {
  children: ReactNode;
  initialSavedSlugs?: string[];
  jobSlugs: string[];
}) {
  const { isAuthLoading, isLoggedIn } = useAuth();
  const [loadedKey, setLoadedKey] = useState("");
  const [isCandidate, setIsCandidate] = useState(false);
  const [savedSlugs, setSavedSlugs] = useState<Set<string>>(new Set());
  const [updatingSlugs, setUpdatingSlugs] = useState<Set<string>>(new Set());
  const normalizedJobSlugs = useMemo(() => normalizeSlugs(jobSlugs), [jobSlugs]);
  const normalizedInitialSavedSlugs = useMemo(
    () => normalizeSlugs(initialSavedSlugs ?? []),
    [initialSavedSlugs],
  );
  const jobSlugKey = normalizedJobSlugs.join("\u0000");
  const initialSavedSlugKey = normalizedInitialSavedSlugs.join("\u0000");
  const requestKey = `${isLoggedIn ? "logged-in" : "logged-out"}|${jobSlugKey}|${initialSavedSlugKey}`;
  const isAuthReady = loadedKey === requestKey;

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let isMounted = true;

    async function loadSavedState() {
      if (!isLoggedIn || !supabase) {
        if (isMounted) {
          setIsCandidate(false);
          setSavedSlugs(new Set());
          setLoadedKey(requestKey);
        }

        return;
      }

      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError || !userData.user) {
          throw userError ?? new Error("Authentication required");
        }

        const profileResult = await getProfile(userData.user.id);
        const candidate = profileResult.profile?.role_mode === "job_seeker";

        if (!candidate && profileResult.error) {
          throw new Error(profileResult.error);
        }

        if (!isMounted) {
          return;
        }

        setIsCandidate(candidate);

        if (!candidate || normalizedJobSlugs.length === 0) {
          setSavedSlugs(new Set());
          setLoadedKey(requestKey);
          return;
        }

        if (initialSavedSlugs) {
          setSavedSlugs(new Set(normalizedInitialSavedSlugs));
          setLoadedKey(requestKey);
          return;
        }

        const { data, error } = await supabase.rpc(
          "get_candidate_saved_job_slugs",
          { p_job_slugs: normalizedJobSlugs },
        );

        if (error) {
          throw error;
        }

        if (isMounted) {
          setSavedSlugs(new Set(readSavedJobSlugs(data)));
          setLoadedKey(requestKey);
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.warn("[saved-jobs] saved state lookup failed", error);
        }

        if (isMounted) {
          setIsCandidate(false);
          setSavedSlugs(new Set());
          setLoadedKey(requestKey);
        }
      }
    }

    void loadSavedState();

    return () => {
      isMounted = false;
    };
  }, [
    initialSavedSlugKey,
    initialSavedSlugs,
    isAuthLoading,
    isLoggedIn,
    jobSlugKey,
    normalizedInitialSavedSlugs,
    normalizedJobSlugs,
    requestKey,
  ]);

  const toggleSaved = useCallback(
    async (jobSlug: string, jobTitle: string) => {
      const normalizedSlug = jobSlug.trim();

      if (
        !normalizedSlug ||
        !isAuthReady ||
        !isCandidate ||
        !supabase ||
        updatingSlugs.has(normalizedSlug)
      ) {
        return;
      }

      const isSaved = savedSlugs.has(normalizedSlug);

      setUpdatingSlugs((current) =>
        new Set(current).add(normalizedSlug),
      );

      try {
        const { error } = await supabase.rpc(
          isSaved ? "unsave_job_for_candidate" : "save_job_for_candidate",
          { p_job_slug: normalizedSlug },
        );

        if (error) {
          throw error;
        }

        setSavedSlugs((current) => {
          const next = new Set(current);

          if (isSaved) {
            next.delete(normalizedSlug);
          } else {
            next.add(normalizedSlug);
          }

          return next;
        });
        window.dispatchEvent(
          new CustomEvent(savedJobChangedEvent, {
            detail: { jobSlug: normalizedSlug, saved: !isSaved },
          }),
        );
        showSuccessToast(
          isSaved ? `${jobTitle} removed from Saved Jobs.` : `${jobTitle} saved.`,
        );
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[saved-jobs] save action failed", error);
        }

        showErrorToast(getFriendlySavedJobActionError(error));
      } finally {
        setUpdatingSlugs((current) => {
          const next = new Set(current);
          next.delete(normalizedSlug);
          return next;
        });
      }
    },
    [isAuthReady, isCandidate, savedSlugs, updatingSlugs],
  );

  const value = useMemo<SavedJobsState>(
    () => ({
      isAuthReady,
      isCandidate,
      isLoggedIn,
      isSaved: (jobSlug) => savedSlugs.has(jobSlug),
      isUpdating: (jobSlug) => updatingSlugs.has(jobSlug),
      toggleSaved,
    }),
    [isAuthReady, isCandidate, isLoggedIn, savedSlugs, toggleSaved, updatingSlugs],
  );

  return (
    <SavedJobsStateContext.Provider value={value}>
      {children}
    </SavedJobsStateContext.Provider>
  );
}

export function useSavedJobsState() {
  return useContext(SavedJobsStateContext);
}
