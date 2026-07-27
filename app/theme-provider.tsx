"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { themePreferences, themeStorageKey } from "@/lib/theme";

export default function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
      enableColorScheme
      enableSystem
      storageKey={themeStorageKey}
      themes={[...themePreferences]}
    >
      {children}
    </NextThemeProvider>
  );
}
