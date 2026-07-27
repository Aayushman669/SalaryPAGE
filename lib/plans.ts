export type PricingFeatureGroup = {
  title?: string;
  items: readonly string[];
};

const starterFeatures = [
  "1 Active Job Post",
  "Candidate Applications",
  "Resume Upload Support",
  "Applicant Management",
  "Application Status Workflow",
  "Recruiter Dashboard",
  "My Applications Dashboard",
  "Billing Dashboard",
  "Secure Razorpay Checkout",
  "Instant Plan Activation",
  "Mobile Responsive Dashboard",
  "Email Notifications",
  "Lifetime Access",
] as const;

const growthFeatures = [
  "5 Active Job Posts",
  "Featured Job Posts (Limited)",
  "Priority Job Listing",
  "Advanced Recruiter Dashboard",
  "Usage Analytics",
  "Hiring Activity Timeline",
  "Priority Email Support",
  "Better Usage Limits",
] as const;

const proFeatures = [
  "Unlimited Active Job Posts",
  "Unlimited Featured Job Posts",
  "Premium Priority Support",
] as const;

export const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 49,
    billingLabel: "One-Time",
    badge: null,
    ctaLabel: "Get Starter",
    description:
      "Launch your hiring journey with everything needed to post jobs and manage applicants.",
    featureGroups: [{ items: starterFeatures }],
  },
  {
    id: "growth",
    name: "Growth",
    price: 99,
    billingLabel: "One-Time",
    badge: "MOST POPULAR",
    ctaLabel: "Choose Growth",
    description:
      "Scale your recruitment with more job slots and advanced hiring tools.",
    featureGroups: [
      { items: starterFeatures },
      { title: "Additional Growth Features", items: growthFeatures },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 299,
    billingLabel: "One-Time",
    badge: "BEST VALUE",
    ctaLabel: "Go Pro",
    description:
      "Built for businesses hiring at scale with maximum flexibility.",
    featureGroups: [
      { items: starterFeatures },
      { title: "Additional Growth Features", items: growthFeatures },
      { title: "Additional Pro Features", items: proFeatures },
    ],
  },
] as const;

export type PlanId = (typeof plans)[number]["id"];

export function getPlan(planId: string) {
  return plans.find((plan) => plan.id === planId);
}
