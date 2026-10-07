"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/app/auth-context";

export default function AccountRestrictedPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    await logout();
    router.replace("/login");
  }

  return (
    <main className="ui-consistency-surface flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-12 text-[var(--foreground)]">
      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-7 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Account access</p>
        <h1 className="mt-3 text-2xl font-bold">Your account access is temporarily restricted.</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
          Please contact support if you believe this action was made in error.
        </p>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          className="mt-6 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </button>
      </section>
    </main>
  );
}
