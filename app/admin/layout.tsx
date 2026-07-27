import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Admin Console",
  "Private administration tools for the Job Board platform.",
);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
