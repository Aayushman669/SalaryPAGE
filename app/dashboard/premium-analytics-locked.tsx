import { DashboardSection } from "./dashboard-widgets";
import UpgradeDialog from "../subscriptions/upgrade-dialog";
import type {
  SubscriptionAccess,
  SubscriptionSnapshot,
} from "@/lib/subscriptions";

export default function PremiumAnalyticsLocked({
  access,
  subscription,
}: {
  access: SubscriptionAccess;
  subscription: SubscriptionSnapshot | null;
}) {
  return (
    <DashboardSection
      description="Track views, applications, and performance for your recruiter-owned jobs."
      title="Analytics"
    >
      <div className="mt-6 rounded-2xl border border-yellow-200 bg-gray-50 p-5 sm:p-6 dark:border-yellow-400/40 dark:bg-white/5">
        <p className="text-base font-bold text-gray-900 dark:text-gray-100">
          Advanced analytics are available on eligible plans.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
          Upgrade to see traffic trends, conversion rates, and job performance
          without changing your existing jobs.
        </p>
        <div className="mt-5">
          <UpgradeDialog
            currentPlan={subscription?.plan.name ?? "Free"}
            feature="Premium Analytics"
            reason={access.reason}
          />
        </div>
      </div>
    </DashboardSection>
  );
}
