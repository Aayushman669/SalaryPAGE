import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Set a New Password",
  "Set a new secure password for your Job Board account.",
);

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
