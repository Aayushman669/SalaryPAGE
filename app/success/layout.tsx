import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Payment Complete",
  "Your private Job Board payment flow has completed.",
);

export default function SuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
