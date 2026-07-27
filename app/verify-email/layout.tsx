import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Verify Your Email",
  "Confirm your email address to continue with Job Board.",
);

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
