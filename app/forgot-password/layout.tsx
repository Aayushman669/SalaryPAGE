import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Reset Your Password",
  "Request a secure JobForge password reset link.",
);

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
