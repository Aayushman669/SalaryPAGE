import { supabase } from "@/lib/supabase";

async function requestPublicCacheRevalidation(
  path: string,
  body?: Record<string, string>,
) {
  if (typeof window === "undefined" || !supabase) {
    return;
  }

  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      return;
    }

    await fetch(path, {
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      method: "POST",
    });
  } catch {
    // Cache invalidation is non-critical to the successful user mutation.
  }
}

export function notifyPublicJobChanged(jobId: string) {
  return requestPublicCacheRevalidation("/api/revalidate/public-job", { jobId });
}

export function notifyPublicCompanyChanged() {
  return requestPublicCacheRevalidation("/api/revalidate/public-company");
}
