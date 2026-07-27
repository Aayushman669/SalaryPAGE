"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  DashboardProfile,
  RoleBasedDashboardData,
} from "@/lib/dashboard-data";
import { canProfileAccessPostJob } from "@/lib/posting-access";
import { searchPlaceholder, type SearchAction } from "@/lib/search";
import { useGlobalSearch } from "./use-global-search";

type GlobalSearchProps = {
  dashboardData: RoleBasedDashboardData;
  profile: DashboardProfile;
};

const focusableSelector =
  'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ShortcutHint() {
  return (
    <span className="hidden items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-400 sm:inline-flex">
      <span>Ctrl</span>
      <span>+</span>
      <span>K</span>
    </span>
  );
}

function ComingSoonBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
      {label}
    </span>
  );
}

function SearchActionRow({
  action,
  isActive,
  onSelect,
}: {
  action: SearchAction;
  isActive: boolean;
  onSelect: () => void;
}) {
  const className = `flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-yellow-100 ${
    isActive
      ? "border-yellow-300 bg-yellow-50/70"
      : "border-gray-200 bg-white hover:border-yellow-300 hover:bg-yellow-50/50"
  } ${action.disabled ? "cursor-not-allowed opacity-70" : ""}`;

  const content = (
    <>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-gray-900">
          {action.title}
        </span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-gray-500">
          {action.description}
        </span>
      </span>
      {action.badge ? <ComingSoonBadge label={action.badge} /> : null}
    </>
  );

  if (action.disabled || !action.href) {
    return (
      <button type="button" disabled className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link href={action.href} onClick={onSelect} className={className}>
      {content}
    </Link>
  );
}

function RecentSearchRow({
  isActive,
  onRemove,
  onSelect,
  search,
}: {
  isActive: boolean;
  onRemove: () => void;
  onSelect: () => void;
  search: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors duration-200 ${
        isActive ? "border-yellow-300 bg-yellow-50/70" : "border-gray-200 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold text-gray-900 focus:outline-none"
      >
        <SearchIcon />
        <span className="truncate">{search}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-gray-400 transition-colors duration-200 hover:bg-yellow-50 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-100"
      >
        <span aria-hidden="true">x</span>
        <span className="sr-only">Remove {search}</span>
      </button>
    </div>
  );
}

export default function GlobalSearch({
  dashboardData,
  profile,
}: GlobalSearchProps) {
  const router = useRouter();
  const titleId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const {
    activeIndex,
    clearRecentSearches,
    groups,
    isSearching,
    quickActions,
    query,
    recentSearches,
    removeRecentSearchText,
    runRecentSearch,
    saveRecentSearch,
    setActiveIndex,
    setQuery,
  } = useGlobalSearch({
    role: dashboardData.role,
    userId: profile.id,
  });
  const visibleQuickActions = useMemo(
    () =>
      quickActions.flatMap((action) => {
        if (action.id !== "post-job") {
          return [action];
        }

        if (canProfileAccessPostJob(profile)) {
          return [action];
        }

        if (profile.role_mode === "recruiter") {
          return [
            {
              ...action,
              description: "Choose a paid plan to unlock job posting.",
              href: "/pricing",
              id: "unlock-post-job",
              title: "Unlock Posting",
            },
          ];
        }

        return [];
      }),
    [profile, quickActions],
  );

  const idleItems = useMemo(
    () => [
      ...recentSearches.map((recentSearch) => ({
        id: `recent:${recentSearch}`,
        query: recentSearch,
        type: "recent" as const,
      })),
      ...visibleQuickActions.map((action) => ({
        action,
        id: `action:${action.id}`,
        type: "action" as const,
      })),
    ],
    [recentSearches, visibleQuickActions],
  );

  const closeSearch = useCallback(() => {
    setIsOpen(false);
  }, []);

  const openSearch = useCallback(() => {
    setIsOpen(true);
  }, []);

  useEffect(() => {
    function handleGlobalShortcut(event: globalThis.KeyboardEvent) {
      const isSearchShortcut =
        event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey);

      if (!isSearchShortcut) {
        return;
      }

      event.preventDefault();
      openSearch();
    }

    document.addEventListener("keydown", handleGlobalShortcut);

    return () => {
      document.removeEventListener("keydown", handleGlobalShortcut);
    };
  }, [openSearch]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousFocusRef.current = document.activeElement;
    const focusId = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    function getFocusableElements() {
      return Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => !element.hasAttribute("disabled"));
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        modalRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }

      closeSearch();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();

      if (focusableElements.length === 0) {
        event.preventDefault();
        modalRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusId);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);

      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [closeSearch, isOpen]);

  function handleModalKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(Math.min(activeIndex + 1, Math.max(idleItems.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(Math.max(activeIndex - 1, 0));
      return;
    }

    if (event.key === "Enter" && !query.trim()) {
      const activeItem = idleItems[activeIndex];

      if (!activeItem) {
        return;
      }

      if (activeItem.type === "recent") {
        runRecentSearch(activeItem.query);
        return;
      }

      if (activeItem.action.disabled || !activeItem.action.href) {
        return;
      }

      saveRecentSearch(activeItem.action.title);
      closeSearch();
      router.push(activeItem.action.href);
    }
  }

  function handleSubmit() {
    if (query.trim()) {
      saveRecentSearch(query);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openSearch}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-900 shadow-[0_10px_24px_rgba(17,24,39,0.06)] transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200 sm:w-80 sm:justify-between sm:px-4 md:w-[28rem] lg:w-[32rem]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <SearchIcon />
          <span className="hidden truncate text-sm font-semibold text-gray-500 sm:inline">
            {searchPlaceholder}
          </span>
        </span>
        <ShortcutHint />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-white/75 backdrop-blur-sm">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={handleModalKeyDown}
            className="flex h-full flex-col overflow-hidden bg-[#FEFEFC] text-gray-900 outline-none sm:absolute sm:left-1/2 sm:top-16 sm:h-auto sm:max-h-[calc(100vh-8rem)] sm:w-[min(720px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-3xl sm:border sm:border-gray-200 sm:shadow-[0_30px_90px_rgba(17,24,39,0.16)]"
          >
            <div className="border-b border-gray-200 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Global Search
                  </p>
                  <h2
                    id={titleId}
                    className="mt-1 text-xl font-bold tracking-tight text-gray-900"
                  >
                    Search
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeSearch}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-500 transition-colors duration-200 hover:border-yellow-300 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-100"
                >
                  <span aria-hidden="true">x</span>
                  <span className="sr-only">Close search</span>
                </button>
              </div>

              <form
                className="mt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSubmit();
                }}
              >
                <label className="relative block">
                  <span className="sr-only">{searchPlaceholder}</span>
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <SearchIcon />
                  </span>
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm font-medium text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                  />
                </label>
                <p className="mt-2 text-xs text-gray-400">
                  Press Ctrl+K or Cmd+K anytime to open search.
                </p>
              </form>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:max-h-[60vh] sm:px-6">
              {query.trim() ? (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-gray-900">Results</p>
                    {isSearching ? (
                      <span className="text-xs font-semibold text-gray-400">
                        Searching...
                      </span>
                    ) : null}
                  </div>

                  {!isSearching && groups.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-gray-200 bg-white px-5 py-8 text-center">
                      <p className="text-base font-bold text-gray-900">
                        No results found
                      </p>
                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        We couldn&apos;t find anything matching your search.
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-5">
                    {groups.map((group) => (
                      <section key={group.category}>
                        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                          {group.label}
                        </h3>
                        <div className="mt-2 grid gap-2">
                          {group.results.map((result) =>
                            result.disabled || !result.href ? (
                              <button
                                key={result.id}
                                type="button"
                                disabled
                                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left opacity-70"
                              >
                                <span className="block text-sm font-bold text-gray-900">
                                  {result.title}
                                </span>
                                <span className="mt-1 block text-xs text-gray-500">
                                  {result.description}
                                </span>
                              </button>
                            ) : (
                              <Link
                                key={result.id}
                                href={result.href}
                                onClick={() => {
                                  saveRecentSearch(query);
                                  closeSearch();
                                }}
                                className="rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-100"
                              >
                                <span className="block text-sm font-bold text-gray-900">
                                  {result.title}
                                </span>
                                <span className="mt-1 block text-xs text-gray-500">
                                  {result.description}
                                </span>
                              </Link>
                            ),
                          )}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid gap-6">
                  <section>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-gray-900">
                        Recent Searches
                      </h3>
                      {recentSearches.length > 0 ? (
                        <button
                          type="button"
                          onClick={clearRecentSearches}
                          className="text-xs font-semibold text-gray-500 transition-colors duration-200 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-100"
                        >
                          Clear all
                        </button>
                      ) : null}
                    </div>
                    {recentSearches.length > 0 ? (
                      <div className="mt-3 grid gap-2">
                        {recentSearches.map((recentSearch, index) => (
                          <RecentSearchRow
                            key={recentSearch}
                            isActive={index === activeIndex}
                            onRemove={() => removeRecentSearchText(recentSearch)}
                            onSelect={() => runRecentSearch(recentSearch)}
                            search={recentSearch}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-gray-200 bg-white px-5 py-6 text-center">
                        <p className="text-sm font-semibold text-gray-900">
                          No recent searches yet.
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Your recent search text will appear here.
                        </p>
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="text-sm font-bold text-gray-900">
                      Quick Actions
                    </h3>
                    <div className="mt-3 grid gap-2">
                        {visibleQuickActions.map((action, index) => (
                          <SearchActionRow
                            key={action.id}
                            action={action}
                            isActive={recentSearches.length + index === activeIndex}
                            onSelect={() => {
                              saveRecentSearch(action.title);
                              closeSearch();
                          }}
                        />
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
