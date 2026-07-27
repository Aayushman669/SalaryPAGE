import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Create an Account",
  "Create your Job Board account and start finding or managing great roles.",
);

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
