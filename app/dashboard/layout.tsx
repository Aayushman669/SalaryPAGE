import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Workspace Dashboard",
  "Your private JobForge workspace for jobs, applications, interviews, and insights.",
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
