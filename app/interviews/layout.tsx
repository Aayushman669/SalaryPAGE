import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Interview Management",
  "Manage your private interview schedule and candidate conversations.",
);

export default function InterviewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
