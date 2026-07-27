"use client";

import { useEffect, useId, useRef, useState } from "react";

const focusableSelector =
  'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function InterviewReasonDialog({
  confirmLabel,
  description,
  isBusy,
  onCancel,
  onConfirm,
  placeholder,
  title,
}: {
  confirmLabel: string;
  description: string;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  placeholder: string;
  title: string;
}) {
  const descriptionId = useId();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab") return;
      const elements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      );
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
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
  }, [isBusy, onCancel]);

  return (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-900/35 px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_28px_90px_rgba(17,24,39,0.22)] sm:p-6"
        ref={dialogRef}
      >
        <h2 className="text-xl font-bold tracking-tight text-gray-900" id={titleId}>
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-gray-500" id={descriptionId}>
          {description}
        </p>
        <label className="mt-5 grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
            Reason
          </span>
          <textarea
            aria-label="Reason"
            className="min-h-24 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
            disabled={isBusy}
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
            placeholder={placeholder}
            value={reason}
          />
        </label>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:opacity-60"
            disabled={isBusy}
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy || reason.trim().length < 3}
            onClick={() => onConfirm(reason.trim())}
            type="button"
          >
            {isBusy ? "Updating..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
