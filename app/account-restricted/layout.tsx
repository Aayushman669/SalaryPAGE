import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Account Access Restricted",
  "Your JobForge account access is currently restricted.",
);

export default function AccountRestrictedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
