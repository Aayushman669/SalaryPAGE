"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSavedJobsState } from "./saved-jobs-state";

export default function SaveJobButton({
  compact = false,
  jobSlug,
  jobTitle,
}: {
  compact?: boolean;
  jobSlug: string;
  jobTitle: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const savedJobs = useSavedJobsState();

  if (!savedJobs) {
    return null;
  }

  if (savedJobs.isAuthReady && savedJobs.isLoggedIn && !savedJobs.isCandidate) {
    return null;
  }

  const isSaved = savedJobs.isSaved(jobSlug);
  const isUpdating = savedJobs.isUpdating(jobSlug);
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;
  const label = isUpdating
    ? isSaved
      ? `Removing ${jobTitle} from saved jobs`
      : `Saving ${jobTitle}`
    : isSaved
      ? `Remove ${jobTitle} from saved jobs`
      : `Save ${jobTitle}`;

  return (
    <button
      aria-busy={isUpdating ? "true" : undefined}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? "h-10 px-3" : "h-11 w-full px-4"
      } ${
        isSaved
          ? "border-yellow-300 bg-yellow-50 text-gray-900 hover:bg-yellow-100"
          : "border-gray-200 bg-white text-gray-900 hover:border-yellow-300 hover:bg-yellow-50/60"
      }`}
      disabled={isUpdating || !savedJobs.isAuthReady}
      onClick={() => {
        if (!savedJobs.isLoggedIn) {
          router.push(loginHref);
          return;
        }

        void savedJobs.toggleSaved(jobSlug, jobTitle);
      }}
      title={label}
      type="button"
    >
      <span aria-hidden="true" className="text-base leading-none">
        {isSaved ? "♥" : "♡"}
      </span>
      <span>{isUpdating ? (isSaved ? "Removing" : "Saving") : isSaved ? "Saved" : "Save Job"}</span>
    </button>
  );
}
