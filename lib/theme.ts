export type ThemePreference = "light" | "dark" | "system";

export const themeStorageKey = "job_board_theme_preference";

export const themePreferences = ["light", "dark", "system"] as const;

export const themeLabels: Record<ThemePreference, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

export const themeDescriptions: Record<ThemePreference, string> = {
  dark: "Use a dark interface where supported.",
  light: "Use the current light interface.",
  system: "Follow your device preference.",
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : "light";
}
