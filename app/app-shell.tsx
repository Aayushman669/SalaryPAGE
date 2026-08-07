"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import AuthRouteGuard from "./auth-route-guard";
import Sidebar from "./sidebar";
import NotificationAutoToast from "./notifications/notification-auto-toast";
import { sidebarCollapsedStorageKey } from "@/lib/sidebar-state";

function applyDesktopSidebarState(isCollapsed: boolean) {
  document.documentElement.dataset.sidebarCollapsed = String(isCollapsed);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    let isCollapsed =
      document.documentElement.dataset.sidebarCollapsed === "true";

    try {
      const storedValue = window.localStorage.getItem(
        sidebarCollapsedStorageKey,
      );

      if (storedValue === "true" || storedValue === "false") {
        isCollapsed = storedValue === "true";
      } else if (storedValue !== null) {
        window.localStorage.removeItem(sidebarCollapsedStorageKey);
        isCollapsed = false;
      }
    } catch {
      // The shell still works when storage is unavailable.
    }

    applyDesktopSidebarState(isCollapsed);

    const syncId = window.requestAnimationFrame(() => {
      setIsDesktopCollapsed(isCollapsed);
    });

    return () => {
      window.cancelAnimationFrame(syncId);
    };
  }, []);

  const toggleDesktopSidebar = useCallback(() => {
    setIsDesktopCollapsed((currentValue) => {
      const nextValue = !currentValue;

      applyDesktopSidebarState(nextValue);

      try {
        window.localStorage.setItem(
          sidebarCollapsedStorageKey,
          String(nextValue),
        );
      } catch {
        // A storage failure should not block the current interaction.
      }

      return nextValue;
    });
  }, []);

  const openMobileSidebar = useCallback(() => {
    setIsMobileOpen(true);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  return (
    <>
      <Sidebar
        isDesktopCollapsed={isDesktopCollapsed}
        isMobileOpen={isMobileOpen}
        onDesktopToggle={toggleDesktopSidebar}
        onMobileClose={closeMobileSidebar}
        onMobileOpen={openMobileSidebar}
      />
      <NotificationAutoToast />
      <div
        aria-hidden={isMobileOpen || undefined}
        inert={isMobileOpen}
        className="app-shell-content min-h-screen"
      >
        <main>
          <AuthRouteGuard>{children}</AuthRouteGuard>
        </main>
      </div>
    </>
  );
}
