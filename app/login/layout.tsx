import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Log In",
  "Log in to your JobForge account.",
);

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
