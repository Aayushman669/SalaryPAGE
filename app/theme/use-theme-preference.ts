"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { logAuthError } from "@/lib/auth-errors";
import {
  normalizeThemePreference,
  themeDescriptions,
  themeLabels,
  type ThemePreference,
} from "@/lib/theme";
import { showErrorToast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";

type UseThemePreferenceArgs = {
  enableProfileSync?: boolean;
  userId?: string;
};

export function useThemePreference({
  enableProfileSync = false,
  userId,
}: UseThemePreferenceArgs = {}): {
  description: string;
  isMounted: boolean;
  label: string;
  preference: ThemePreference;
  resolvedTheme: string | undefined;
  setPreference: (preference: ThemePreference) => Promise<void>;
} {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const mountedId = window.setTimeout(() => {
      setIsMounted(true);
    }, 0);

    return () => {
      window.clearTimeout(mountedId);
    };
  }, []);

  const preference = useMemo(() => normalizeThemePreference(theme), [theme]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    if (theme && normalizeThemePreference(theme) !== theme) {
      setTheme("light");
    }
  }, [isMounted, setTheme, theme]);

  const setPreference = useCallback(
    async (nextPreference: ThemePreference) => {
      const safePreference = normalizeThemePreference(nextPreference);

      setTheme(safePreference);

      if (!enableProfileSync || !userId || !supabase) {
        return;
      }

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError || !authData.user || authData.user.id !== userId) {
          showErrorToast(
            "Theme saved locally.",
            "We could not verify your profile session for sync.",
          );
          return;
        }

        const { error } = await supabase
          .from("profiles")
          .update({ theme_preference: safePreference })
          .eq("id", authData.user.id);

        if (error) {
          logAuthError("[theme] profile preference update failed", error);
          showErrorToast(
            "Theme saved locally.",
            "We could not sync your theme to your profile yet.",
          );
        }
      } catch (error) {
        logAuthError("[theme] profile preference update network failure", error);
        showErrorToast(
          "Theme saved locally.",
          "We could not sync your theme to your profile yet.",
        );
      }
    },
    [enableProfileSync, setTheme, userId],
  );

  return {
    description: themeDescriptions[preference],
    isMounted,
    label: themeLabels[preference],
    preference,
    resolvedTheme,
    setPreference,
  };
}
