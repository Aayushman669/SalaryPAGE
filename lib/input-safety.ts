const controlCharacterPattern = /[\u0000-\u001f\u007f]/;
const publicSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function safeHttpUrl(
  value: string | null | undefined,
  options: { httpsOnly?: boolean; maxLength?: number } = {},
) {
  const candidate = value?.trim() ?? "";
  const maxLength = options.maxLength ?? 2_000;

  if (
    !candidate ||
    candidate.length > maxLength ||
    candidate.startsWith("//") ||
    controlCharacterPattern.test(candidate)
  ) {
    return null;
  }

  try {
    const url = new URL(candidate);

    if (options.httpsOnly ? url.protocol !== "https:" : !["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    if (url.username || url.password) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function safeHttpsUrl(value: string | null | undefined) {
  return safeHttpUrl(value, { httpsOnly: true, maxLength: 500 });
}

export function safePublicSlug(value: string | null | undefined) {
  const slug = value?.trim().toLowerCase() ?? "";

  return slug.length <= 160 && publicSlugPattern.test(slug) ? slug : "";
}

export function clampPositivePage(value: number, max = 10_000) {
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : 1;
}

