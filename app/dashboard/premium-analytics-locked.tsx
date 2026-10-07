import UpgradeDialog from "../subscriptions/upgrade-dialog";
import { AnalyticsIllustration } from "./recruiter-illustrations";
import type { SubscriptionAccess, SubscriptionSnapshot } from "@/lib/subscriptions";

export default function PremiumAnalyticsLocked({ access, subscription }: { access: SubscriptionAccess; subscription: SubscriptionSnapshot | null }) {
  return (
    <section className="recruiter-analytics-section">
      <header className="recruiter-plan-header"><span className="recruiter-analytics-header-icon" aria-hidden="true"><svg fill="none" viewBox="0 0 24 24"><path d="m4 16 5-5 4 3 7-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg></span><div><h2>Analytics</h2><p>Track views, applications, and performance for your recruiter-owned jobs.</p></div></header>
      <div className="recruiter-analytics-lockup"><div><p className="recruiter-analytics-lockup-title">Advanced analytics are available on eligible plans.</p><p className="recruiter-analytics-lockup-copy">Upgrade to see traffic trends, conversion rates, and job performance without changing your existing jobs.</p><div className="recruiter-analytics-unlock"><UpgradeDialog currentPlan={subscription?.plan.name ?? "Free"} feature="Premium Analytics" reason={access.reason} /></div></div><AnalyticsIllustration /></div>
    </section>
  );
}
