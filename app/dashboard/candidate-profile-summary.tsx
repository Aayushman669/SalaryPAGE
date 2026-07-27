"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardProfile } from "@/lib/dashboard-data";
import {
  getCandidateAssetUrl,
  getCandidateProfile,
  type CandidateProfile,
} from "@/lib/candidate-profile";
import CandidateAvatar from "@/app/applications/candidate-avatar";

export default function CandidateProfileSummary({
  candidateProfile: providedCandidateProfile,
  profile,
}: {
  candidateProfile?: CandidateProfile | null;
  profile: DashboardProfile;
}) {
  const [loadedCandidateProfile, setLoadedCandidateProfile] =
    useState<CandidateProfile | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (providedCandidateProfile !== undefined) {
      return;
    }

    let active = true;

    async function loadCandidateSummary() {
      const result = await getCandidateProfile();

      if (!active) {
        return;
      }

      setLoadedCandidateProfile(result.candidateProfile);
      setHasError(Boolean(result.error));
      setIsLoading(false);
    }

    void loadCandidateSummary();

    return () => {
      active = false;
    };
  }, [profile.id, providedCandidateProfile]);

  const candidateProfile =
    providedCandidateProfile ?? loadedCandidateProfile;
  const profileLoading = providedCandidateProfile === undefined && isLoading;
  const profileHasError = providedCandidateProfile === undefined && hasError;

  useEffect(() => {
    let active = true;

    async function loadPhoto() {
      if (!candidateProfile?.profile_photo_path) {
        setPhotoUrl(null);
        return;
      }

      const url = await getCandidateAssetUrl(candidateProfile.profile_photo_path);

      if (active) {
        setPhotoUrl(url);
      }
    }

    void loadPhoto();

    return () => {
      active = false;
    };
  }, [candidateProfile?.profile_photo_path]);

  const completion = Math.max(
    0,
    Math.min(100, candidateProfile?.profile_completion ?? 0),
  );
  const resumeStatus = candidateProfile?.resume_path
    ? "Resume ready"
    : "Resume not uploaded";

  return (
    <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-border bg-muted p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <CandidateAvatar
          imageUrl={photoUrl ?? profile.avatar_url}
          name={profile.full_name}
          size="md"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Candidate profile
          </p>
          {profileLoading ? (
            <div
              aria-busy="true"
              className="mt-2 h-5 w-40 animate-pulse rounded-full bg-muted-foreground/20"
            />
          ) : (
            <p className="truncate text-base font-bold text-card-foreground">
              {profile.full_name?.trim() || "Complete your candidate profile"}
            </p>
          )}
          {!profileLoading && candidateProfile?.professional_headline ? (
            <p
              className="mt-1 truncate text-sm text-muted-foreground"
              title={candidateProfile.professional_headline}
            >
              {candidateProfile.professional_headline}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            {profileHasError
              ? "Profile details unavailable"
              : `${completion}% complete - ${resumeStatus}`}
          </p>
          {!hasError && completion < 100 ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Complete your profile to improve recruiter visibility.
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden min-w-32 sm:block">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>Complete</span>
            <span>{completion}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted-foreground/20">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
        <Link
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground transition hover:bg-accent/10 focus:outline-none focus:ring-4 focus:ring-yellow-200"
          href="/settings/profile"
        >
          {completion < 100 ? "Complete Profile" : "Edit Profile"}
        </Link>
      </div>
    </section>
  );
}
