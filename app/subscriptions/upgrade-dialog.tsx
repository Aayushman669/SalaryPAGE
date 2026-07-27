"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { SubscriptionAccess } from "@/lib/subscriptions";

const focusableSelector =
  'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function getRestrictionMessage(reason: SubscriptionAccess["reason"]) {
  if (reason === "subscription_pending") {
    return "Your payment is still being confirmed. Complete activation before using premium features.";
  }

  if (reason === "not_recruiter") {
    return "This feature is available for Recruiter accounts with an eligible plan.";
  }

  return "Your current plan does not include this feature yet.";
}

export default function UpgradeDialog({
  currentPlan,
  feature,
  reason,
}: {
  currentPlan: string;
  feature: string;
  reason: SubscriptionAccess["reason"];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ??
          [],
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_12px_28px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
      >
        Unlock {feature}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/35 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_28px_90px_rgba(17,24,39,0.22)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
                  Plan feature
                </p>
                <h2
                  id={titleId}
                  className="mt-2 text-xl font-bold tracking-tight text-gray-900"
                >
                  Unlock {feature}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close upgrade dialog"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-lg text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200"
              >
                ×
              </button>
            </div>
            <p
              id={descriptionId}
              className="mt-4 text-sm leading-6 text-gray-500"
            >
              {getRestrictionMessage(reason)}
            </p>
            <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50/60 p-3 text-sm text-gray-800">
              Current plan: <span className="font-bold">{currentPlan}</span>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-colors hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200"
              >
                Not now
              </button>
              <Link
                href="/pricing"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_12px_28px_rgba(17,24,39,0.16)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
              >
                Go to Pricing
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
