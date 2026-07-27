import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Applications",
  "Review and manage your private applications and applicants.",
);

export default function ApplicationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
