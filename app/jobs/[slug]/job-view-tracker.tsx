"use client";

import { useEffect } from "react";

export default function JobViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) {
      return;
    }

    const controller = new AbortController();

    fetch(`/api/jobs/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      signal: controller.signal,
    }).catch((error: unknown) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[job-view] tracking request failed", error);
      }
    });

    return () => {
      controller.abort();
    };
  }, [slug]);

  return null;
}
