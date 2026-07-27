import { searchPublicJobs } from "@/lib/public-jobs";

export type SearchCategory =
  | "applications"
  | "companies"
  | "jobs"
  | "notifications"
  | "settings"
  | "users";

export type SearchResult = {
  badge?: string;
  category: SearchCategory;
  description: string;
  disabled?: boolean;
  href?: string;
  id: string;
  title: string;
};

export type SearchGroup = {
  category: SearchCategory;
  label: string;
  results: SearchResult[];
};

export type SearchAction = {
  badge?: string;
  description: string;
  disabled?: boolean;
  href?: string;
  id: string;
  title: string;
};

export type SearchProviderContext = {
  role?: "job_seeker" | "recruiter" | null;
};

export type SearchProvider = {
  category: SearchCategory;
  label: string;
  search: (
    query: string,
    context?: SearchProviderContext,
  ) => Promise<SearchResult[]> | SearchResult[];
};

export type SearchState = {
  activeIndex: number;
  debouncedQuery: string;
  groups: SearchGroup[];
  isOpen: boolean;
  isSearching: boolean;
  query: string;
  recentSearches: string[];
};

export const maxRecentSearches = 10;
export const searchPlaceholder = "Search jobs, companies, applications...";

const searchCategoryLabels: Record<SearchCategory, string> = {
  applications: "Applications",
  companies: "Companies",
  jobs: "Jobs",
  notifications: "Notifications",
  settings: "Settings",
  users: "Users",
};

export const globalSearchProviders: SearchProvider[] = [
  {
    category: "jobs",
    label: searchCategoryLabels.jobs,
    search: async (query) => {
      const jobs = await searchPublicJobs(query, 5);

      return jobs.map((job) => ({
        category: "jobs",
        description: `${job.companyName} / ${job.location} / ${job.category}`,
        href: `/jobs/${job.slug}`,
        id: `job:${job.slug}`,
        title: job.title,
      }));
    },
  },
  {
    category: "companies",
    label: searchCategoryLabels.companies,
    search: () => [],
  },
  {
    category: "applications",
    label: searchCategoryLabels.applications,
    search: () => [],
  },
  {
    category: "notifications",
    label: searchCategoryLabels.notifications,
    search: () => [],
  },
  {
    category: "settings",
    label: searchCategoryLabels.settings,
    search: () => [],
  },
  {
    category: "users",
    label: searchCategoryLabels.users,
    search: () => [],
  },
];

export const globalSearchQuickActions: SearchAction[] = [
  {
    description: "Open your main dashboard.",
    href: "/dashboard",
    id: "dashboard",
    title: "Dashboard",
  },
  {
    description: "Browse public job listings.",
    href: "/jobs",
    id: "jobs",
    title: "Jobs",
  },
  {
    description: "Create a new job listing.",
    href: "/post-job",
    id: "post-job",
    title: "Post Job",
  },
  {
    description: "Compare available plans.",
    href: "/pricing",
    id: "pricing",
    title: "Pricing",
  },
  {
    description: "Review your account notifications.",
    href: "/notifications",
    id: "notifications",
    title: "Notifications",
  },
  {
    description: "Open your account settings foundation.",
    href: "/settings",
    id: "settings",
    title: "Settings",
  },
];

function normalizeSearchText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function uniqueRecentSearches(searches: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const search of searches) {
    const normalizedSearch = normalizeSearchText(search);
    const key = normalizedSearch.toLowerCase();

    if (!normalizedSearch || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalizedSearch);
  }

  return result.slice(0, maxRecentSearches);
}

export function getSearchStorageKey(userId: string) {
  return `job_board_recent_searches_${userId}`;
}

export function readRecentSearches(storageKey: string) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    return Array.isArray(parsedValue)
      ? uniqueRecentSearches(
          parsedValue.filter((value): value is string => typeof value === "string"),
        )
      : [];
  } catch {
    return [];
  }
}

export function writeRecentSearches(storageKey: string, searches: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(uniqueRecentSearches(searches)),
    );
  } catch {
    // Recent searches are local convenience data and can safely fall back to memory.
  }
}

export function addRecentSearch(searches: string[], query: string) {
  return uniqueRecentSearches([query, ...searches]);
}

export function removeRecentSearch(searches: string[], query: string) {
  const normalizedQuery = normalizeSearchText(query).toLowerCase();

  return searches.filter(
    (search) => search.toLowerCase() !== normalizedQuery,
  );
}

export function groupSearchResults(
  providers: SearchProvider[],
  results: SearchResult[],
): SearchGroup[] {
  return providers
    .map((provider) => ({
      category: provider.category,
      label: provider.label,
      results: results.filter((result) => result.category === provider.category),
    }))
    .filter((group) => group.results.length > 0);
}

export async function runGlobalSearch({
  context,
  providers = globalSearchProviders,
  query,
}: {
  context?: SearchProviderContext;
  providers?: SearchProvider[];
  query: string;
}): Promise<SearchGroup[]> {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const results = (
    await Promise.all(
      providers.map((provider) => Promise.resolve(provider.search(normalizedQuery, context))),
    )
  ).flat();

  return groupSearchResults(providers, results);
}

export function flattenSearchGroups(groups: SearchGroup[]) {
  return groups.flatMap((group) => group.results);
}
