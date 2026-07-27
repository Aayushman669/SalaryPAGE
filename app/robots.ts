import type { MetadataRoute } from "next";
import { getProductionSiteUrl } from "@/lib/seo";

const privateRouteRules = [
  "/admin",
  "/account-restricted",
  "/dashboard",
  "/applications",
  "/interviews",
  "/settings",
  "/post-job",
  "/onboarding",
  "/saved-jobs",
  "/job-alerts",
  "/auth",
  "/api",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/success",
  "/jobs/create",
  "/recruiter",
  "/job-seeker",
];

export default function robots(): MetadataRoute.Robots {
  const productionSiteUrl = getProductionSiteUrl();

  if (!productionSiteUrl) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: privateRouteRules,
    },
    sitemap: new URL("/sitemap.xml", productionSiteUrl).toString(),
    host: productionSiteUrl.host,
  };
}
