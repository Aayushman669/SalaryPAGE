import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Account Onboarding",
  "Complete your private Job Board account setup.",
);

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
