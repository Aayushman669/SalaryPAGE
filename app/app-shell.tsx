"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import AuthRouteGuard from "./auth-route-guard";
import Sidebar from "./sidebar";
import NotificationAutoToast from "./notifications/notification-auto-toast";
import { sidebarCollapsedStorageKey } from "@/lib/sidebar-state";

function applyDesktopSidebarState(isCollapsed: boolean) {
  document.documentElement.dataset.sidebarCollapsed = String(isCollapsed);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHomeRoute = pathname === "/";
  const usesCanvasChrome =
    isHomeRoute || pathname === "/pricing" || pathname === "/saved-jobs";
  const isDashboardRoute = pathname === "/dashboard";
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(usesCanvasChrome);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    let isCollapsed = isHomeRoute
      ? true
      : isDashboardRoute
        ? false
        : document.documentElement.dataset.sidebarCollapsed === "true";

    if (!isHomeRoute && !isDashboardRoute) {
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
    }

    applyDesktopSidebarState(isCollapsed);

    const syncId = window.requestAnimationFrame(() => {
      setIsDesktopCollapsed(isCollapsed);
    });

    return () => {
      window.cancelAnimationFrame(syncId);
    };
  }, [isDashboardRoute, isHomeRoute]);

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
        usesCanvasChrome={usesCanvasChrome}
        isMobileOpen={isMobileOpen}
        onDesktopToggle={toggleDesktopSidebar}
        onMobileClose={closeMobileSidebar}
        onMobileOpen={openMobileSidebar}
      />
      <NotificationAutoToast />
      <div
        aria-hidden={isMobileOpen || undefined}
        inert={isMobileOpen}
        className={`app-shell-content min-h-screen ${isHomeRoute ? "home-route-content" : ""}`}
      >
        <main>
          <AuthRouteGuard>{children}</AuthRouteGuard>
        </main>
      </div>
    </>
  );
}
