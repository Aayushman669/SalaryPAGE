import type { Metadata } from "next";

export const siteName = "Job Board";
export const siteDescription =
  "Discover quality jobs from growing companies and manage hiring with a focused, modern job board.";
export const siteLocale = "en_US";
export const defaultSocialImage = "/opengraph-image";

function readConfiguredSiteUrl() {
  const configuredValues = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
  ];

  for (const value of configuredValues) {
    if (!value?.trim()) {
      continue;
    }

    try {
      const url = new URL(value.trim());

      const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
      const isLocalProductionHost = process.env.NODE_ENV === "production" && (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1"
      );

      if (
        (url.protocol === "http:" || url.protocol === "https:") &&
        !isLocalProductionHost
      ) {
        return url;
      }
    } catch {
      // Ignore invalid deployment configuration and try the next source.
    }
  }

  return null;
}

export const siteUrl = readConfiguredSiteUrl();

const vercelEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();

export const isProductionDeployment = Boolean(siteUrl)
  && process.env.NODE_ENV === "production"
  && (!vercelEnvironment || vercelEnvironment === "production");

export function getProductionSiteUrl() {
  return isProductionDeployment ? siteUrl : null;
}

export function getCanonicalUrl(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  return siteUrl
    ? new URL(normalizedPath, siteUrl).toString()
    : normalizedPath;
}

type PublicMetadataOptions = {
  description: string;
  image?: string | null;
  imageAlt?: string;
  noIndex?: boolean;
  path: string;
  title: string;
  type?: "article" | "profile" | "website";
};

export function cleanSeoText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-+*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidTimestamp(value: string | null) {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

export function isPublicJobIndexable(
  job: {
    expiresAt: string | null;
    moderationStatus: string | null;
    publishAt: string | null;
    publishedAt: string | null;
    status: string | null;
  },
  now = Date.now(),
) {
  const publishedAt = job.publishedAt ? Date.parse(job.publishedAt) : NaN;
  const publishAt = job.publishAt ? Date.parse(job.publishAt) : null;
  const expiresAt = job.expiresAt ? Date.parse(job.expiresAt) : null;

  if (job.status !== "published" || job.moderationStatus !== "active") {
    return false;
  }

  if (
    !isValidTimestamp(job.publishedAt) ||
    (job.publishAt && !isValidTimestamp(job.publishAt)) ||
    (job.expiresAt && !isValidTimestamp(job.expiresAt))
  ) {
    return false;
  }

  if (
    publishedAt > now ||
    (publishAt !== null && publishAt > now)
  ) {
    return false;
  }

  return expiresAt === null || expiresAt > now;
}

export function createPublicMetadata({
  description,
  image,
  imageAlt,
  noIndex = false,
  path,
  title,
  type = "website",
}: PublicMetadataOptions): Metadata {
  const canonical = siteUrl ? getCanonicalUrl(path) : undefined;
  const socialImage = image || (siteUrl ? defaultSocialImage : null);

  return {
    title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    ...(!isProductionDeployment || noIndex
      ? { robots: { follow: false, index: false } }
      : {}),
    openGraph: {
      description,
      images: socialImage
        ? [
            {
              alt: imageAlt || `${siteName} social preview`,
              url: socialImage,
            },
          ]
        : undefined,
      locale: siteLocale,
      siteName,
      title,
      type,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      description,
      images: socialImage ? [socialImage] : undefined,
      title,
    },
  };
}

export function createPrivateMetadata(
  title: string,
  description: string,
): Metadata {
  return {
    title,
    description,
    robots: {
      follow: false,
      index: false,
    },
  };
}

export const globalMetadata: Metadata = {
  // Keep local and preview builds explicit while production indexing remains
  // disabled until a verified public site URL is configured.
  metadataBase: siteUrl ?? new URL("http://localhost:3000"),
  title: {
    default: "Find Your Dream Job | Job Board",
    template: "%s | Job Board",
  },
  description: siteDescription,
  applicationName: siteName,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  category: "jobs",
  keywords: ["jobs", "careers", "hiring", "employment", "job board"],
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  ...(siteUrl ? { alternates: { canonical: getCanonicalUrl("/") } } : {}),
  openGraph: {
    description: siteDescription,
    images: siteUrl
      ? [
          {
            alt: `${siteName} social preview`,
            height: 630,
            url: defaultSocialImage,
            width: 1200,
          },
        ]
      : undefined,
    locale: siteLocale,
    siteName,
    title: "Find Your Dream Job | Job Board",
    type: "website",
    url: siteUrl ? getCanonicalUrl("/") : undefined,
  },
  twitter: {
    card: "summary_large_image",
    description: siteDescription,
    images: siteUrl ? [defaultSocialImage] : undefined,
    title: "Find Your Dream Job | Job Board",
  },
  ...(!isProductionDeployment
    ? { robots: { follow: false, index: false } }
    : {}),
  icons: {
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest",
};
