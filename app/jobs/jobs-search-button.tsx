"use client";

import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function createJobsSearchHref(form: HTMLFormElement | null) {
  if (!form) {
    return "/jobs";
  }

  const formData = new FormData(form);
  const params = new URLSearchParams();
  const values = {
    category: readFormValue(formData, "category"),
    employment_type: readFormValue(formData, "employment_type"),
    experience_level: readFormValue(formData, "experience_level"),
    featured: formData.get("featured") === "true" ? "true" : "",
    location: readFormValue(formData, "location"),
    q: readFormValue(formData, "q"),
    sort: readFormValue(formData, "sort"),
    workplace_type: readFormValue(formData, "workplace_type"),
  };

  for (const [key, value] of Object.entries(values)) {
    if (!value || (key === "sort" && value === "newest")) {
      continue;
    }

    params.set(key, value);
  }

  const queryString = params.toString();

  return queryString ? `/jobs?${queryString}` : "/jobs";
}

export default function JobsSearchButton() {
  const router = useRouter();

  function handleSearch(event: MouseEvent<HTMLButtonElement>) {
    router.replace(createJobsSearchHref(event.currentTarget.form));
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSearch}
      className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_14px_30px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
    >
      Search Jobs
    </button>
  );
}
