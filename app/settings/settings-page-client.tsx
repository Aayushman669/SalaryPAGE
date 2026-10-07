"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AuthLoading from "../auth-loading";
import { useAuth } from "../auth-context";
import { isValidRole } from "@/lib/dashboard-data";
import {
  getSettingsSection,
  getSettingsSectionHref,
  normalizeSettingsSectionForRole,
  type SettingsSectionId,
} from "@/lib/settings";
import {
  SettingsBillingPanel,
  SettingsComingSoon,
  SettingsError,
  SettingsLayout,
  SettingsSectionPanel,
  SettingsSkeleton,
} from "./settings-layout";
import { useSettingsData } from "./use-settings-data";

function SettingsSectionLoading() {
  return (
    <div
      aria-busy="true"
      className="min-h-[24rem] animate-pulse rounded-2xl border border-border bg-muted"
      role="status"
    />
  );
}

const RecruiterSettingsSection = dynamic(
  () =>
    import("./recruiter-settings-panels").then(
      (module) => module.RecruiterSettingsSection,
    ),
  { loading: () => <SettingsSectionLoading /> },
);
const CandidateSettingsSection = dynamic(
  () =>
    import("./candidate-settings-panels").then(
      (module) => module.CandidateSettingsSection,
    ),
  { loading: () => <SettingsSectionLoading /> },
);

type SettingsPageClientProps = {
  initialSectionId?: string;
};

function getSettingsSectionFromPathname(pathname: string) {
  if (pathname !== "/settings" && !pathname.startsWith("/settings/")) {
    return undefined;
  }

  return pathname.slice("/settings".length).split("/").filter(Boolean)[0];
}

function SettingsContent({
  activeSectionId,
  profile,
}: {
  activeSectionId: SettingsSectionId;
  profile: NonNullable<ReturnType<typeof useSettingsData>["profile"]>;
}) {
  const activeSection = getSettingsSection(activeSectionId);

  return (
    <SettingsSectionPanel section={activeSection}>
      {activeSectionId === "profile" ? (
        profile.role_mode === "job_seeker" ? (
          <CandidateSettingsSection
            activeSectionId={activeSectionId}
            profile={profile}
          />
        ) : (
          <RecruiterSettingsSection
            activeSectionId={activeSectionId}
            profile={profile}
          />
        )
      ) : activeSectionId === "account" && profile.role_mode === "recruiter" ? (
        <RecruiterSettingsSection
          activeSectionId={activeSectionId}
          profile={profile}
        />
      ) : activeSectionId === "notifications" ? (
        profile.role_mode === "job_seeker" ? (
          <CandidateSettingsSection
            activeSectionId={activeSectionId}
            profile={profile}
          />
        ) : (
          <RecruiterSettingsSection
            activeSectionId={activeSectionId}
            profile={profile}
          />
        )
      ) : activeSectionId === "preferences" && profile.role_mode === "recruiter" ? (
        <RecruiterSettingsSection
          activeSectionId={activeSectionId}
          profile={profile}
        />
      ) : activeSectionId === "privacy" && profile.role_mode === "job_seeker" ? (
        <CandidateSettingsSection
          activeSectionId={activeSectionId}
          profile={profile}
        />
      ) : activeSectionId === "job-alerts" && profile.role_mode === "job_seeker" ? (
        <CandidateSettingsSection
          activeSectionId={activeSectionId}
          profile={profile}
        />
      ) : activeSectionId === "security" && profile.role_mode === "job_seeker" ? (
        <CandidateSettingsSection
          activeSectionId={activeSectionId}
          profile={profile}
        />
      ) : activeSectionId === "security" && profile.role_mode === "recruiter" ? (
        <RecruiterSettingsSection
          activeSectionId={activeSectionId}
          profile={profile}
        />
      ) : activeSectionId === "billing" && profile.role_mode === "recruiter" ? (
        <SettingsBillingPanel />
      ) : activeSectionId === "danger" && profile.role_mode === "job_seeker" ? (
        <CandidateSettingsSection
          activeSectionId={activeSectionId}
          profile={profile}
        />
      ) : activeSectionId === "danger" && profile.role_mode === "recruiter" ? (
        <RecruiterSettingsSection
          activeSectionId={activeSectionId}
          profile={profile}
        />
      ) : (
        <SettingsComingSoon />
      )}
    </SettingsSectionPanel>
  );
}

export default function SettingsPageClient({
  initialSectionId,
}: SettingsPageClientProps) {
  const router = useRouter();
  const { isAuthLoading, isLoggedIn } = useAuth();
  const {
    error,
    loading,
    profile,
    retry,
  } = useSettingsData({ isAuthLoading, isLoggedIn });
  const [sectionOverride, setSectionOverride] = useState<string | null | undefined>(
    null,
  );
  const requestedSectionId =
    sectionOverride === null ? initialSectionId : sectionOverride;

  const activeSectionId = normalizeSettingsSectionForRole(
    requestedSectionId,
    profile?.role_mode ?? null,
  );

  const handleSectionChange = useCallback(
    (sectionId: SettingsSectionId) => {
      const nextSectionId = normalizeSettingsSectionForRole(
        sectionId,
        profile?.role_mode ?? null,
      );

      setSectionOverride(nextSectionId);

      if (typeof window !== "undefined") {
        const nextPath = getSettingsSectionHref(nextSectionId);

        if (window.location.pathname !== nextPath) {
          window.history.replaceState(window.history.state, "", nextPath);
        }
      }
    },
    [profile?.role_mode],
  );

  useEffect(() => {
    function handlePopState() {
      setSectionOverride(
        getSettingsSectionFromPathname(window.location.pathname),
      );
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const handleCloseSettings = useCallback(() => {
    if (typeof window === "undefined") {
      router.replace("/dashboard");
      return;
    }

    const returnPath = window.sessionStorage.getItem(
      "job_board_settings_return_path",
    );

    window.sessionStorage.removeItem("job_board_settings_return_path");

    if (
      returnPath &&
      returnPath.startsWith("/") &&
      !returnPath.startsWith("//") &&
      !returnPath.startsWith("/settings")
    ) {
      router.replace(returnPath);
      return;
    }

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.replace("/dashboard");
  }, [router]);

  useEffect(() => {
    if (isAuthLoading || loading || !isLoggedIn || !profile) {
      return;
    }

    if (!isValidRole(profile.role_mode)) {
      router.replace("/onboarding");
    }
  }, [isAuthLoading, isLoggedIn, loading, profile, router]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleCloseSettings();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleCloseSettings]);

  if (isAuthLoading || loading) {
    return <SettingsSkeleton onClose={handleCloseSettings} />;
  }

  if (!isLoggedIn) {
    return <AuthLoading />;
  }

  if (error) {
    return (
      <SettingsError
        message={error}
        onClose={handleCloseSettings}
        onRetry={retry}
      />
    );
  }

  if (
    !profile || !isValidRole(profile.role_mode)
  ) {
    return <SettingsSkeleton onClose={handleCloseSettings} />;
  }

  return (
    <SettingsLayout
      activeSectionId={activeSectionId}
      onClose={handleCloseSettings}
      onSectionChange={handleSectionChange}
      profile={profile}
    >
      <SettingsContent activeSectionId={activeSectionId} profile={profile} />
    </SettingsLayout>
  );
}
