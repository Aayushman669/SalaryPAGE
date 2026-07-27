import type { Metadata } from "next";
import { createPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = createPublicMetadata({
  title: "Browse Jobs",
  description: "Search published jobs by title, company, location, and work style.",
  path: "/jobs",
});

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
