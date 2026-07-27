"use client";

import type { ReactNode } from "react";
import AuthRouteGuard from "./auth-route-guard";
import Sidebar from "./sidebar";
import NotificationAutoToast from "./notifications/notification-auto-toast";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Sidebar />
      <NotificationAutoToast />
      <div className="min-h-screen lg:pl-64">
        <main>
          <AuthRouteGuard>{children}</AuthRouteGuard>
        </main>
      </div>
    </>
  );
}
