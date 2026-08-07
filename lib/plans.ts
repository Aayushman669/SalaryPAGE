export type PricingFeatureGroup = {
  title?: string;
  items: readonly string[];
};

const starterFeatures = [
  "2 Active Job Posts",
  "Up to 100 Applications",
  "Resume Downloads",
  "Applicant Management",
  "Application Status Tracking",
  "Recruiter Dashboard",
  "Email Notifications",
  "Mobile Dashboard",
  "Lifetime Access",
] as const;

const growthFeatures = [
  "5 Active Job Posts",
  "Unlimited Applications",
  "Featured Job Posts",
  "Priority Job Listing",
  "Advanced Recruiter Dashboard",
  "Hiring Activity Timeline",
  "Candidate Analytics",
  "Priority Email Support",
  "Better Usage Limits",
] as const;

const proFeatures = [
  "12 Active Job Posts",
  "Unlimited Resume Downloads",
  "Company Branding",
  "Team Collaboration",
  "Priority Candidate Visibility",
  "Premium Support",
  "Advanced Hiring Workflow",
  "Future AI Features",
  "Early Access to New Features",
] as const;

export const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 79,
    billingLabel: "(One-Time)",
    badge: null,
    ctaLabel: "Get Starter",
    description:
      "Launch a focused hiring workflow with job posts, applications, and essential recruiter tools.",
    featureGroups: [{ items: starterFeatures }],
  },
  {
    id: "growth",
    name: "Growth",
    price: 159,
    billingLabel: "(One-Time)",
    badge: "Most Popular",
    ctaLabel: "Choose Growth",
    description:
      "Expand hiring capacity with stronger visibility, analytics, and priority support.",
    featureGroups: [
      { title: "Everything in Starter, plus:", items: growthFeatures },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 399,
    billingLabel: "(One-Time)",
    badge: "Enterprise Ready",
    ctaLabel: "Go Pro",
    description:
      "Equip larger teams with branding, collaboration, premium workflows, and future-ready features.",
    featureGroups: [
      { title: "Everything in Growth, plus:", items: proFeatures },
    ],
  },
] as const;

export type PlanId = (typeof plans)[number]["id"];

export function getPlan(planId: string) {
  return plans.find((plan) => plan.id === planId);
}
