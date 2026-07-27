import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Saved Jobs",
  "View your private saved job list.",
);

export default function SavedJobsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
