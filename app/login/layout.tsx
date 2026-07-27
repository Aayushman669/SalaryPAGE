import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Log In",
  "Log in to your Job Board account.",
);

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
