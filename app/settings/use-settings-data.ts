"use client";

import { useMemo } from "react";
import type { DashboardPanelGroup, DashboardQuickActionItem, DashboardStat } from "@/lib/dashboard-data";
import type { SettingsData } from "@/lib/settings";
import { buildSettingsData } from "@/lib/settings";
import { useDashboardData } from "../dashboard/use-dashboard-data";

type UseSettingsDataArgs = {
  isAuthLoading: boolean;
  isLoggedIn: boolean;
};

export function useSettingsData({
  isAuthLoading,
  isLoggedIn,
}: UseSettingsDataArgs): {
  dashboardData: ReturnType<typeof useDashboardData>["dashboardData"];
  dashboardStats: DashboardStat[];
  error: string;
  loading: boolean;
  profile: ReturnType<typeof useDashboardData>["profile"];
  quickActions: DashboardQuickActionItem[];
  recentActivity: DashboardPanelGroup | null;
  retry: () => void;
  settingsData: SettingsData | null;
} {
  const dashboardResult = useDashboardData({
    isAuthLoading,
    isLoggedIn,
  });

  const settingsData = useMemo(
    () =>
      dashboardResult.profile
        ? buildSettingsData(dashboardResult.profile)
        : null,
    [dashboardResult.profile],
  );

  return {
    dashboardData: dashboardResult.dashboardData,
    dashboardStats: dashboardResult.dashboardStats,
    error: dashboardResult.error,
    loading: dashboardResult.loading,
    profile: dashboardResult.profile,
    quickActions: dashboardResult.quickActions,
    recentActivity: dashboardResult.recentActivity,
    retry: dashboardResult.retry,
    settingsData,
  };
}
