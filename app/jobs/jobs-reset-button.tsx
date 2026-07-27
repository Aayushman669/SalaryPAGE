"use client";

import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";

function clearJobsFilterForm(form: HTMLFormElement | null) {
  if (!form) {
    return;
  }

  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox" || element.type === "radio") {
        element.checked = false;
      } else {
        element.value = "";
      }
    }

    if (element instanceof HTMLSelectElement) {
      element.value = element.name === "sort" ? "newest" : "";
    }
  }
}

export default function JobsResetButton() {
  const router = useRouter();

  function handleReset(event: MouseEvent<HTMLButtonElement>) {
    clearJobsFilterForm(event.currentTarget.form);
    router.replace("/jobs");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleReset}
      className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
    >
      Reset
    </button>
  );
}
