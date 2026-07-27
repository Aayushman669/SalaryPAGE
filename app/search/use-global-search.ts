"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardRole } from "@/lib/dashboard-data";
import {
  addRecentSearch,
  flattenSearchGroups,
  getSearchStorageKey,
  globalSearchProviders,
  globalSearchQuickActions,
  readRecentSearches,
  removeRecentSearch,
  runGlobalSearch,
  writeRecentSearches,
  type SearchAction,
  type SearchGroup,
  type SearchResult,
} from "@/lib/search";

type UseGlobalSearchArgs = {
  role: DashboardRole;
  userId: string;
};

export function useGlobalSearch({
  role,
  userId,
}: UseGlobalSearchArgs): {
  activeIndex: number;
  clearRecentSearches: () => void;
  debouncedQuery: string;
  groups: SearchGroup[];
  isSearching: boolean;
  quickActions: SearchAction[];
  query: string;
  recentSearches: string[];
  removeRecentSearchText: (query: string) => void;
  results: SearchResult[];
  runRecentSearch: (query: string) => void;
  saveRecentSearch: (query: string) => void;
  setActiveIndex: (index: number) => void;
  setQuery: (query: string) => void;
} {
  const storageKey = useMemo(() => getSearchStorageKey(userId), [userId]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      setRecentSearches(readRecentSearches(storageKey));
    }, 0);

    return () => {
      window.clearTimeout(loadId);
    };
  }, [storageKey]);

  useEffect(() => {
    const debounceId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 180);

    return () => {
      window.clearTimeout(debounceId);
    };
  }, [query]);

  useEffect(() => {
    let isMounted = true;

    async function search() {
      if (!debouncedQuery) {
        setGroups([]);
        setIsSearching(false);
        setActiveIndex(0);
        return;
      }

      setIsSearching(true);

      const nextGroups = await runGlobalSearch({
        context: { role },
        providers: globalSearchProviders,
        query: debouncedQuery,
      });

      if (!isMounted) {
        return;
      }

      setGroups(nextGroups);
      setActiveIndex(0);
      setIsSearching(false);
    }

    search();

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, role]);

  const results = useMemo(() => flattenSearchGroups(groups), [groups]);

  const saveRecentSearch = useCallback(
    (nextQuery: string) => {
      setRecentSearches((currentSearches) => {
        const nextSearches = addRecentSearch(currentSearches, nextQuery);

        writeRecentSearches(storageKey, nextSearches);

        return nextSearches;
      });
    },
    [storageKey],
  );

  const removeRecentSearchText = useCallback(
    (nextQuery: string) => {
      setRecentSearches((currentSearches) => {
        const nextSearches = removeRecentSearch(currentSearches, nextQuery);

        writeRecentSearches(storageKey, nextSearches);

        return nextSearches;
      });
    },
    [storageKey],
  );

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    writeRecentSearches(storageKey, []);
  }, [storageKey]);

  const runRecentSearch = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
  }, []);

  return {
    activeIndex,
    clearRecentSearches,
    debouncedQuery,
    groups,
    isSearching,
    quickActions: globalSearchQuickActions,
    query,
    recentSearches,
    removeRecentSearchText,
    results,
    runRecentSearch,
    saveRecentSearch,
    setActiveIndex,
    setQuery,
  };
}
