import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Signing You In",
  "Completing secure Job Board authentication.",
);

export default function AuthCallbackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
