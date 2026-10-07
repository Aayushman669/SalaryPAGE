"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

type CandidateAvatarProps = {
  ariaLabel?: string;
  imageUrl?: string | null;
  name?: string | null;
  size?: "lg" | "md" | "sm";
};

function normalizeCandidateName(name: string | null | undefined) {
  return name?.trim().replace(/\s+/g, " ") || "Unknown Candidate";
}

function getCandidateInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "UC";
  }

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

export default function CandidateAvatar({
  ariaLabel = "avatar",
  imageUrl,
  name,
  size = "sm",
}: CandidateAvatarProps) {
  const displayName = normalizeCandidateName(name);
  const initials = getCandidateInitials(displayName);
  const normalizedImageUrl = imageUrl?.trim() || null;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const showImage =
    Boolean(normalizedImageUrl) && failedImageUrl !== normalizedImageUrl;
  const sizeClassName =
    size === "lg"
      ? "h-14 w-14 text-base"
      : size === "md"
        ? "h-11 w-11 text-sm"
        : "h-9 w-9 text-xs";

  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-900 font-bold text-white shadow-[0_8px_18px_rgba(17,24,39,0.14)] dark:border-white/10 dark:bg-white/10 dark:text-gray-100 ${sizeClassName}`}
      title={displayName}
    >
      {showImage && normalizedImageUrl ? (
        <img
          alt={`${displayName} ${ariaLabel}`}
          className="h-full w-full object-cover"
          decoding="async"
          loading="lazy"
          onError={() => setFailedImageUrl(normalizedImageUrl)}
          src={normalizedImageUrl}
        />
      ) : (
        <span
          aria-label={`${displayName} ${ariaLabel}`}
          className="flex h-full w-full items-center justify-center"
          role="img"
        >
          {initials}
        </span>
      )}
    </span>
  );
}
