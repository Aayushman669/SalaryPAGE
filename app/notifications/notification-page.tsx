"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/auth-context";
import { supabase } from "@/lib/supabase";
import type { NotificationListFilter } from "@/lib/notification-service";
import NotificationCard from "./notification-card";
import { useNotifications } from "./use-notifications";

function NotificationListSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4" role="status">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="flex gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-muted" />
          <div className="grid min-w-0 flex-1 gap-3">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationPage() {
  const { isAuthLoading, isLoggedIn } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationListFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (isAuthLoading || !isLoggedIn || !supabase) {
      return;
    }

    let active = true;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) {
        return;
      }

      if (error || !data.user) {
        setIdentityError("Your session expired. Please sign in again.");
        return;
      }

      setUserId(data.user.id);
    });

    return () => {
      active = false;
    };
  }, [isAuthLoading, isLoggedIn]);

  const notifications = useNotifications({
    enabled: Boolean(userId),
    filter,
    limit: 20,
    search: debouncedSearch,
    userId: userId ?? "",
  });

  if (isAuthLoading || (isLoggedIn && !userId && !identityError)) {
    return <main className="min-h-screen bg-background px-6 py-10 sm:px-8 lg:px-12"><div className="mx-auto max-w-4xl"><NotificationListSkeleton /></div></main>;
  }

  if (!isLoggedIn || identityError) {
    return (
      <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 lg:px-12">
        <section className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-7">
          <h1 className="text-2xl font-bold">Notifications unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{identityError ?? "Please sign in to view your notifications."}</p>
          <Link href="/login?next=%2Fnotifications" className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus:outline-none focus:ring-4 focus:ring-yellow-300">Sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-8 sm:py-14 lg:px-12">
      <section className="mx-auto w-full max-w-4xl">
        <div className="flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/dashboard" className="rounded-lg px-2 py-1 text-sm font-semibold text-yellow-700 underline-offset-4 hover:underline focus:outline-none focus:ring-4 focus:ring-yellow-100 dark:text-yellow-300">Back to dashboard</Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Notification Center</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Notifications</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Review updates from your account and hiring activity.</p>
          </div>
          <div className="text-sm text-muted-foreground" aria-live="polite">{notifications.unreadCount} unread</div>
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Search notifications</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search titles or messages" className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-4 focus:ring-yellow-200" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Show</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value as NotificationListFilter)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-4 focus:ring-yellow-200">
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button type="button" disabled={notifications.unreadCount === 0 || notifications.isMarkingAllAsRead} onClick={() => void notifications.markAllAsRead()} className="min-h-11 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:border-yellow-300 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-yellow-200">{notifications.isMarkingAllAsRead ? "Updating..." : "Mark all read"}</button>
            <button type="button" disabled={notifications.notifications.length === 0 || notifications.isClearing} onClick={() => void notifications.clearAll()} className="min-h-11 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-muted-foreground hover:border-yellow-300 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-yellow-200">{notifications.isClearing ? "Clearing..." : "Clear all"}</button>
          </div>
        </div>

        <div className="mt-6" aria-live="polite">
          {notifications.isLoading ? <NotificationListSkeleton /> : null}
          {!notifications.isLoading && notifications.error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">
              <p>{notifications.error}</p>
              <button type="button" onClick={() => void notifications.refresh()} className="mt-4 rounded-lg bg-black px-4 py-2 font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-300">Retry</button>
            </div>
          ) : null}
          {!notifications.isLoading && !notifications.error && notifications.notifications.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
              <h2 className="text-lg font-bold">{search || filter !== "all" ? "No matching notifications" : "You're all caught up"}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{search || filter !== "all" ? "Try another search or show all notifications." : "New account and activity updates will appear here."}</p>
              {search || filter !== "all" ? <button type="button" onClick={() => { setSearch(""); setFilter("all"); }} className="mt-5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-yellow-300 focus:outline-none focus:ring-4 focus:ring-yellow-200">Clear filters</button> : null}
            </div>
          ) : null}
          {!notifications.isLoading && !notifications.error && notifications.notifications.length > 0 ? (
            <div className="grid gap-4">
              {notifications.notifications.map((notification) => <NotificationCard key={notification.id} notification={notification} onMarkAsRead={notifications.markAsRead} onRemove={notifications.remove} pending={notifications.pendingNotificationIds.includes(notification.id)} />)}
              {notifications.hasMore ? <button type="button" disabled={notifications.isLoadingMore} onClick={() => void notifications.loadMore()} className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:border-yellow-300 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-yellow-200">{notifications.isLoadingMore ? "Loading more..." : "Load more"}</button> : null}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
