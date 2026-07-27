import type { Metadata } from "next";
import { createPrivateMetadata } from "@/lib/seo";

export const metadata: Metadata = createPrivateMetadata(
  "Billing & Subscription",
  "Manage your private Job Board subscription and payment history.",
);

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
