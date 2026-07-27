"use client";

import { themeDescriptions, themeLabels, themePreferences } from "@/lib/theme";
import type { ThemePreference } from "@/lib/theme";
import { useThemePreference } from "./use-theme-preference";

type ThemeSelectorProps = {
  enableProfileSync?: boolean;
  userId?: string;
};

export default function ThemeSelector({
  enableProfileSync = false,
  userId,
}: ThemeSelectorProps) {
  const { isMounted, preference, setPreference } = useThemePreference({
    enableProfileSync,
    userId,
  });

  return (
    <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 shadow-[0_10px_24px_rgba(17,24,39,0.06)] transition-colors duration-200 hover:border-yellow-300 hover:bg-yellow-50/60">
      <span className="sr-only">Theme preference</span>
      <span aria-hidden="true" className="text-xs font-black uppercase text-gray-400">
        Theme
      </span>
      <select
        aria-label="Theme preference"
        disabled={!isMounted}
        value={isMounted ? preference : "light"}
        onChange={(event) => {
          void setPreference(event.target.value as ThemePreference);
        }}
        className="bg-transparent text-sm font-semibold text-gray-900 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-gray-400"
      >
        {themePreferences.map((themePreference) => (
          <option
            key={themePreference}
            value={themePreference}
            title={themeDescriptions[themePreference]}
          >
            {themeLabels[themePreference]}
          </option>
        ))}
      </select>
    </label>
  );
}
