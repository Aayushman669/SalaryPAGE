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
import { ProfileDocumentIllustration } from "./dashboard-illustrations";

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
    <section className="candidate-profile-card">
      <div className="candidate-profile-identity">
        <CandidateAvatar
          imageUrl={photoUrl ?? profile.avatar_url}
          name={profile.full_name}
          size="lg"
        />
        <div className="candidate-profile-copy">
          <p>Candidate Profile</p>
          {profileLoading ? (
            <div
              aria-busy="true"
              className="candidate-profile-loading animate-pulse"
            />
          ) : (
            <h2 className="truncate">
              {profile.full_name?.trim() || "Complete your candidate profile"}
            </h2>
          )}
          {!profileLoading && candidateProfile?.professional_headline ? (
            <p
              className="candidate-profile-headline truncate"
              title={candidateProfile.professional_headline}
            >
              {candidateProfile.professional_headline}
            </p>
          ) : null}
          <p className="candidate-profile-status">
            {profileHasError
              ? "Profile details unavailable"
              : `${completion}% complete \u2022 ${resumeStatus}`}
          </p>
          {!hasError && completion < 100 ? (
            <p className="candidate-profile-helper">
              Complete your profile to improve recruiter visibility.
            </p>
          ) : null}
        </div>
      </div>
      <div className="candidate-profile-art" aria-hidden="true">
        <span className="candidate-profile-art-wash" />
        <ProfileDocumentIllustration />
        <span className="candidate-profile-art-leaf" />
      </div>
      <div className="candidate-profile-progress-area">
        <div className="candidate-profile-progress">
          <div>
            <span>Complete</span>
            <span>{completion}%</span>
          </div>
          <div role="progressbar" aria-label={`Profile ${completion}% complete`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={completion}>
            <div
              className="candidate-profile-progress-fill"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
        <Link
          className="candidate-profile-button"
          href="/settings/profile"
        >
          {completion < 100 ? "Complete Profile" : "Edit Profile"}
        </Link>
      </div>
    </section>
  );
}
