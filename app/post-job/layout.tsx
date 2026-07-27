import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Post a Job",
  "Create a job listing in your private recruiter workspace.",
);

export default function PostJobLayout({ children }: { children: React.ReactNode }) {
  return children;
}
