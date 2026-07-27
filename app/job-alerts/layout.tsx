import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Job Alerts",
  "Manage your private job alerts and saved search preferences.",
);

export default function JobAlertsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
