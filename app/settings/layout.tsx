import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Account Settings",
  "Manage your private profile, preferences, security, and account settings.",
);

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
