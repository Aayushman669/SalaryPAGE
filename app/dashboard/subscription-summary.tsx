import Link from "next/link";
import {
  getSubscriptionStatus,
  hasActiveSubscription,
  type SubscriptionLimit,
  type SubscriptionSnapshot,
} from "@/lib/subscriptions";
import {
  PlanDocumentIllustration,
  UsageBarsIllustration,
} from "./recruiter-illustrations";

function getUsagePercent(used: number, limit: SubscriptionLimit) {
  if (limit === "unlimited" || limit <= 0) return 0;
  return Math.min(100, Math.round((Math.max(0, used) / limit) * 100));
}

function formatStatus(status: ReturnType<typeof getSubscriptionStatus>, activePaidPlan: boolean) {
  if (activePaidPlan) return status === "lifetime" ? "Lifetime" : "Active";
  if (status === "pending") return "Pending";
  if (status === "expired") return "Expired";
  if (status === "cancelled") return "Cancelled";
  return "No paid plan";
}

function statusClass(activePaidPlan: boolean, status: ReturnType<typeof getSubscriptionStatus>) {
  if (activePaidPlan || status === "lifetime") return "is-active";
  if (status === "pending") return "is-pending";
  return "";
}

export default function RecruiterSubscriptionSummary({ subscription }: { subscription: SubscriptionSnapshot }) {
  const status = getSubscriptionStatus(subscription);
  const activePaidPlan = hasActiveSubscription(subscription) && subscription.plan.slug !== "free";
  const planStatus = formatStatus(status, activePaidPlan);
  const planDescription = activePaidPlan ? `${subscription.plan.name} access is active.` : status === "pending" ? "Your payment is being verified." : "Basic access is active.";
  const jobLimit = subscription.plan.jobPostLimit;
  const jobUsagePercent = getUsagePercent(subscription.usage.jobsPosted, jobLimit);
  const hasJobLimit = jobLimit === "unlimited" || (typeof jobLimit === "number" && jobLimit > 0);
  const jobUsageLabel = !hasJobLimit ? "No posting slots available" : jobLimit === "unlimited" ? `${subscription.usage.jobsPosted} Used - Unlimited available` : `${subscription.usage.jobsPosted} / ${jobLimit} Used`;

  return (
    <section className="recruiter-plan-section">
      <header className="recruiter-plan-header">
        <span className="recruiter-plan-header-icon" aria-hidden="true"><svg fill="none" viewBox="0 0 24 24"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6"><path d="M4 20V11h4v9m4 0V5h4v15m4 0v-7h-4v7M3 20h18" /></g></svg></span>
        <div><h2>Plan &amp; Usage</h2><p>Track your plan, posting limits, and available recruiter benefits.</p></div>
      </header>
      <div className="recruiter-plan-grid">
        <article className="recruiter-plan-card">
          <div className="recruiter-plan-card-top"><p className="recruiter-plan-label">Plan Overview</p><span className={`recruiter-plan-status ${statusClass(activePaidPlan, status)}`} role="status">{planStatus}</span></div>
          <p className="recruiter-plan-name">{activePaidPlan ? subscription.plan.name : "Free"}</p>
          <p className="recruiter-plan-copy">{planDescription}</p>
          <PlanDocumentIllustration />
        </article>
        <article className="recruiter-plan-card recruiter-usage-card">
          <p className="recruiter-plan-label">Job Usage</p>
          <p className="recruiter-usage-title">{jobUsageLabel}</p>
          {hasJobLimit ? <div aria-label={`Active job posts: ${subscription.usage.jobsPosted} of ${jobLimit} used`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={jobUsagePercent} className="recruiter-usage-progress" role="progressbar"><div style={{ width: `${jobUsagePercent}%` }} /></div> : <p className="recruiter-plan-copy">Upgrade to unlock active job posting slots.</p>}
          <UsageBarsIllustration />
        </article>
      </div>
      <div className="recruiter-upgrade-strip"><div className="recruiter-upgrade-copy"><span aria-hidden="true">&#9889;</span><div><h3>Unlock More Hiring Power</h3><p>Upgrade your plan to post more jobs and unlock advanced recruiter tools.</p></div></div><Link className="recruiter-dark-button" href="/pricing">Upgrade Plan</Link></div>
    </section>
  );
}
