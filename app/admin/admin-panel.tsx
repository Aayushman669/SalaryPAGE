"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/auth-context";
import { supabase } from "@/lib/supabase";
import type {
  AdminApplication,
  AdminAnalyticsRange,
  AdminCompany,
  AdminJob,
  AdminModerationAction,
  AdminOverview,
  AdminPayment,
  AdminRankedItem,
  AdminSection,
  AdminUser,
} from "@/lib/admin-types";
import { adminSections } from "@/lib/admin-types";
import AdminTable, { type AdminTableColumn } from "./admin-table";
import ModerationControls from "./moderation-controls";

type Row = AdminUser | AdminCompany | AdminJob | AdminApplication | AdminPayment | AdminModerationAction;
type FilterState = Record<string, string>;

const sectionMeta: Record<AdminSection, { description: string; title: string }> = {
  overview: { description: "A read-only view of the platform’s core entities.", title: "Overview" },
  users: { description: "Review accounts and profile completion without exposing auth secrets.", title: "Users" },
  companies: { description: "Review recruiter-owned company profiles and their public readiness.", title: "Companies" },
  jobs: { description: "Inspect job records across their current publishing lifecycle.", title: "Jobs" },
  applications: { description: "Review candidate applications with private recruiter fields excluded.", title: "Applications" },
  payments: { description: "Review verified payment and subscription records safely.", title: "Payments" },
  moderation: { description: "Review exception-based enforcement actions and immutable audit history.", title: "Moderation" },
};

const initialFilters: FilterState = { actionType: "", dateFrom: "", dateTo: "", featured: "", plan: "", role: "", search: "", sort: "newest", status: "", targetType: "", verification: "" };

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function formatLabel(value: string | null | undefined) {
  return (value ?? "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusPill({ value }: { value: string | null | undefined }) {
  return <span className="inline-flex max-w-full items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">{formatLabel(value)}</span>;
}

function valueForDetail(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "Not available";
  return String(value);
}

function DetailDialog({ row, section, onClose, onModerationComplete }: { row: Row; section: AdminSection; onClose: () => void; onModerationComplete: () => void }) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const entries = Object.entries(row as unknown as Record<string, unknown>);
  const moderationTarget = section === "users" ? { target: "user" as const, status: (row as AdminUser).moderationStatus, label: (row as AdminUser).fullName } : section === "companies" ? { target: "company" as const, status: (row as AdminCompany).moderationStatus, label: (row as AdminCompany).name } : section === "jobs" ? { target: "job" as const, status: (row as AdminJob).moderationStatus, label: (row as AdminJob).title } : section === "applications" ? { target: "application" as const, status: (row as AdminApplication).moderationStatus, label: (row as AdminApplication).jobTitle } : section === "payments" ? { target: "payment" as const, status: (row as AdminPayment).moderationStatus, label: (row as AdminPayment).planName } : null;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"))
        .filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} aria-labelledby="admin-detail-title" aria-modal="true" role="dialog" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-gray-200 bg-[var(--card)] p-5 text-[var(--card-foreground)] shadow-2xl focus:outline-none sm:rounded-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{sectionMeta[section].title} detail</p>
            <h2 id="admin-detail-title" className="mt-2 text-xl font-bold">Read-only record</h2>
          </div>
          <button type="button" aria-label="Close detail" onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-yellow-300 dark:border-gray-700 dark:hover:bg-gray-800">Close</button>
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key} className="min-w-0 rounded-xl border border-gray-200 bg-[var(--muted)] p-3 dark:border-gray-800">
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">{formatLabel(key)}</dt>
              <dd className="mt-1 break-words text-sm font-medium">{valueForDetail(value)}</dd>
            </div>
          ))}
        </dl>
        {moderationTarget ? <ModerationControls target={moderationTarget.target} targetId={row.id} targetLabel={moderationTarget.label} status={moderationTarget.status} onComplete={onModerationComplete} /> : null}
      </section>
    </div>
  );
}

function AdminNavigation({ section }: { section: AdminSection }) {
  return (
    <nav aria-label="Admin navigation" className="grid gap-1.5">
      {adminSections.map((item) => (
        <Link key={item} href={item === "overview" ? "/admin" : `/admin/${item}`} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-300 ${section === item ? "border-l-4 border-yellow-500 bg-[var(--muted)] text-[var(--foreground)]" : "text-gray-500 hover:bg-[var(--muted)] hover:text-[var(--foreground)] dark:text-gray-400"}`}>
          {sectionMeta[item].title}
        </Link>
      ))}
    </nav>
  );
}

function AdminFrame({ section, children, onLogout }: { section: AdminSection; children: React.ReactNode; onLogout: () => void }) {
  return (
    <div className="ui-consistency-surface min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[var(--border)] bg-[var(--card)] px-5 py-6 lg:flex lg:flex-col">
        <Link href="/admin" className="flex items-center gap-3 px-2 focus:outline-none focus:ring-4 focus:ring-yellow-300">
          <img alt="JobForge" className="h-10 w-10" height={40} src="/brand/jobforge-monogram-dark.svg" width={40} />
          <span className="font-bold tracking-tight">Admin Console</span>
        </Link>
        <p className="mt-10 px-2 text-xs font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Platform</p>
        <div className="mt-3"><AdminNavigation section={section} /></div>
        <button type="button" onClick={onLogout} className="mt-auto rounded-xl border border-[var(--border)] px-3 py-2.5 text-left text-sm font-semibold text-gray-500 hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus:outline-none focus:ring-4 focus:ring-yellow-300">Log out</button>
      </aside>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 backdrop-blur lg:pl-72">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Admin</p>
            <h1 className="mt-1 text-lg font-bold">{sectionMeta[section].title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onLogout} className="rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] focus:outline-none focus:ring-4 focus:ring-yellow-300 lg:hidden">Log out</button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto lg:hidden"><AdminNavigation section={section} /></div>
      </header>
      <main className="px-4 py-7 sm:px-6 lg:pl-72 lg:pr-10">{children}</main>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

function RankedList({ items, emptyLabel = "No data for this period." }: { items: AdminRankedItem[]; emptyLabel?: string }) {
  if (items.length === 0) return <p className="py-5 text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</p>;
  return <div className="mt-3">{items.map((item, index) => <div key={item.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-0"><div className="flex min-w-0 items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--muted)] text-xs font-bold text-gray-500 dark:text-gray-300">{index + 1}</span><span className="truncate text-sm font-semibold" title={item.name}>{item.name}</span></div><span className="shrink-0 text-sm font-bold">{formatNumber(item.value)}</span></div>)}</div>;
}

function Overview({ overview, range, onRangeChange }: { overview: AdminOverview; range: AdminAnalyticsRange; onRangeChange: (value: AdminAnalyticsRange) => void }) {
  const cards = [
    ["Total Users", overview.counts.users], ["Recruiters", overview.counts.recruiters], ["Candidates", overview.counts.candidates], ["Companies", overview.counts.companies], ["Total Jobs", overview.counts.jobs], ["Active Jobs", overview.counts.activeJobs], ["Draft Jobs", overview.counts.draftJobs], ["Applications", overview.counts.applications], ["Successful Payments", overview.counts.successfulPayments], ["Total Revenue", formatMoney(overview.counts.totalRevenue)], ["Active Paid Users", overview.counts.activePaidUsers],
  ] as const;
  const { analytics } = overview;
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-bold tracking-tight">Platform overview</h2><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{sectionMeta.overview.description}</p></div><SelectFilter label="Analytics period" value={range} options={[["today", "Today"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["90d", "Last 90 days"], ["all", "All time"]]} onChange={(value) => onRangeChange(value as AdminAnalyticsRange)} /></div>
      <section aria-labelledby="admin-summary-heading"><h3 id="admin-summary-heading" className="sr-only">Platform summary</h3><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <article key={String(label)} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">{label}</p><p className="mt-3 text-3xl font-bold">{typeof value === "number" ? formatNumber(value) : value}</p></article>)}</div></section>
      <section aria-labelledby="admin-growth-heading" className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><div><h3 id="admin-growth-heading" className="font-bold">Growth analytics</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">New platform activity in the selected period.</p></div><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric title="New users today" value={analytics.growth.newUsersToday} /><Metric title="New users this week" value={analytics.growth.newUsersThisWeek} /><Metric title="New users this month" value={analytics.growth.newUsersThisMonth} /><Metric title="New users selected" value={analytics.growth.newUsersSelected} /><Metric title="New companies selected" value={analytics.growth.newCompaniesSelected} /><Metric title="New jobs selected" value={analytics.growth.newJobsSelected} /><Metric title="New applications selected" value={analytics.growth.newApplicationsSelected} /></div></section>
      <div className="grid gap-5 xl:grid-cols-2">
        <section aria-labelledby="admin-revenue-heading" className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><h3 id="admin-revenue-heading" className="font-bold">Revenue analytics</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><Metric title="Selected period" value={formatMoney(analytics.revenue.selected)} prefix="" /><Metric title="Today" value={formatMoney(analytics.revenue.today)} prefix="" /><Metric title="This week" value={formatMoney(analytics.revenue.thisWeek)} prefix="" /><Metric title="This month" value={formatMoney(analytics.revenue.thisMonth)} prefix="" /></div><p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Revenue by plan</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{analytics.revenue.byPlan.map((plan) => <div key={plan.slug} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3"><p className="text-sm font-semibold">{plan.name}</p><p className="mt-1 text-lg font-bold">{formatMoney(plan.revenue)}</p></div>)}</div></section>
        <section aria-labelledby="admin-plans-heading" className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><h3 id="admin-plans-heading" className="font-bold">Paid plan distribution</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Recruiters with an active paid entitlement.</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric title="Starter" value={analytics.planDistribution.starter ?? 0} /><Metric title="Growth" value={analytics.planDistribution.growth ?? 0} /><Metric title="Pro" value={analytics.planDistribution.pro ?? 0} /></div></section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2"><RecentBlock title="Top companies by jobs" href="/admin/companies"><RankedList items={analytics.topCompanies.mostJobs} /></RecentBlock><RecentBlock title="Top companies by applications" href="/admin/companies"><RankedList items={analytics.topCompanies.mostApplications} /></RecentBlock><RecentBlock title="Hiring activity by company" href="/admin/companies"><RankedList items={analytics.topCompanies.highestHiringActivity} /></RecentBlock><RecentBlock title="Top recruiters by jobs posted" href="/admin/users"><RankedList items={analytics.topRecruiters.jobsPosted} /></RecentBlock><RecentBlock title="Top recruiters by applications received" href="/admin/users"><RankedList items={analytics.topRecruiters.applicationsReceived} /></RecentBlock></div>
      <div className="grid gap-5 xl:grid-cols-2">
        <RecentBlock title="Recent users" href="/admin/users">{overview.recent.users.map((user) => <div key={user.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-semibold">{user.fullName}</p><p className="truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</p></div><StatusPill value={user.role} /></div>)}</RecentBlock>
        <RecentBlock title="Recent companies" href="/admin/companies">{overview.recent.companies.map((company) => <div key={company.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-0"><p className="truncate text-sm font-semibold">{company.name}</p><StatusPill value={company.verificationStatus} /></div>)}</RecentBlock>
        <RecentBlock title="Recent jobs" href="/admin/jobs">{overview.recent.jobs.map((job) => <div key={job.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-0"><p className="truncate text-sm font-semibold">{job.title}</p><StatusPill value={job.status} /></div>)}</RecentBlock>
        <RecentBlock title="Recent applications" href="/admin/applications">{overview.recent.applications.map((application) => <div key={application.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-semibold">{application.candidateName}</p><p className="truncate text-xs text-gray-500 dark:text-gray-400">{application.jobTitle}</p></div><StatusPill value={application.status} /></div>)}</RecentBlock>
        <RecentBlock title="Recent successful payments" href="/admin/payments">{overview.recent.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-0"><p className="truncate text-sm font-semibold">{payment.planName}</p><span className="text-sm font-semibold">{payment.currency} {payment.amount.toFixed(2)}</span></div>)}</RecentBlock>
      </div>
      <section aria-labelledby="admin-quick-nav-heading" className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><h3 id="admin-quick-nav-heading" className="font-bold">Quick navigation</h3><div className="mt-4 flex flex-wrap gap-2">{adminSections.filter((item) => item !== "overview").map((item) => <Link key={item} href={`/admin/${item}`} className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--muted)] focus:outline-none focus:ring-4 focus:ring-yellow-300">{sectionMeta[item].title}</Link>)}<Link href="/dashboard/billing" className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--muted)] focus:outline-none focus:ring-4 focus:ring-yellow-300">Subscriptions</Link></div></section>
    </div>
  );
}

function Metric({ title, value, prefix = "" }: { title: string; value: number | string; prefix?: string }) {
  return <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3"><p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{title}</p><p className="mt-1 text-xl font-bold">{prefix}{typeof value === "number" ? formatNumber(value) : value}</p></div>;
}

function RecentBlock({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{title}</h3><Link href={href} className="text-sm font-semibold text-yellow-700 underline-offset-4 hover:underline dark:text-yellow-300">View all</Link></div><div className="mt-3">{children}</div></section>;
}

export default function AdminPanel({ section }: { section: AdminSection }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthLoading, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 15, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [submittedFilters, setSubmittedFilters] = useState<FilterState>(initialFilters);
  const [analyticsRange, setAnalyticsRange] = useState<AdminAnalyticsRange>("all");
  const [selected, setSelected] = useState<Row | null>(null);

  const load = useCallback(async () => {
    if (isAuthLoading) return;
    setLoading(true);
    setError("");
    setSelected(null);
    try {
      if (!supabase) throw new Error("Supabase is not configured.");
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data.session?.access_token;
      if (!token) { router.replace(`/login?next=${encodeURIComponent(pathname)}`); return; }
      const params = new URLSearchParams(section === "overview" ? { range: analyticsRange } : { page: String(page), pageSize: "15", ...submittedFilters });
      const response = await fetch(`/api/admin/${section}${params.toString() ? `?${params.toString()}` : ""}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (response.status === 401) { router.replace(`/login?next=${encodeURIComponent(pathname)}`); return; }
      if (response.status === 403) { router.replace("/dashboard"); return; }
      const body = await response.json() as { error?: string; data?: AdminOverview | Row[]; pagination?: typeof pagination };
      if (!response.ok) throw new Error(body.error || "We could not load this admin section.");
      if (section === "overview") setOverview(body.data as AdminOverview);
      else { setRows((body.data ?? []) as Row[]); setPagination(body.pagination ?? { page, pageSize: 15, total: 0, totalPages: 0 }); }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "We could not load this admin section.");
    } finally { setLoading(false); }
  }, [analyticsRange, isAuthLoading, page, pathname, router, section, submittedFilters]);

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(loadId);
  }, [load]);

  const columns = useMemo<AdminTableColumn<Row>[]>(() => {
    if (section === "users") return [
      { key: "name", label: "User", render: (row) => { const user = row as AdminUser; return <div className="min-w-[180px]"><p className="truncate font-semibold" title={user.fullName}>{user.fullName}</p><p className="truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</p></div>; } },
      { key: "role", label: "Role", render: (row) => <StatusPill value={(row as AdminUser).role} /> },
      { key: "completed", label: "Profile", render: (row) => <span>{(row as AdminUser).profileCompleted ? "Complete" : "Incomplete"}</span> },
      { key: "created", label: "Joined", render: (row) => formatDate((row as AdminUser).createdAt) },
    ];
    if (section === "companies") return [
      { key: "company", label: "Company", render: (row) => { const company = row as AdminCompany; return <div className="min-w-[180px]"><p className="truncate font-semibold" title={company.name}>{company.name}</p><p className="truncate text-xs text-gray-500 dark:text-gray-400">/{company.slug}</p></div>; } },
      { key: "owner", label: "Owner", render: (row) => <span className="block max-w-[180px] truncate">{(row as AdminCompany).recruiterName}</span> },
      { key: "status", label: "Verification", render: (row) => <StatusPill value={(row as AdminCompany).verificationStatus} /> },
      { key: "completion", label: "Completion", render: (row) => `${(row as AdminCompany).profileCompletion}%` },
      { key: "jobs", label: "Active jobs", render: (row) => (row as AdminCompany).activeJobCount },
    ];
    if (section === "jobs") return [
      { key: "job", label: "Job", render: (row) => { const job = row as AdminJob; return <div className="min-w-[190px]"><p className="truncate font-semibold" title={job.title}>{job.title}</p><p className="truncate text-xs text-gray-500 dark:text-gray-400">{job.companyName}</p></div>; } },
      { key: "recruiter", label: "Recruiter", render: (row) => <span className="block max-w-[160px] truncate">{(row as AdminJob).recruiterName}</span> },
      { key: "status", label: "Status", render: (row) => <StatusPill value={(row as AdminJob).status} /> },
      { key: "featured", label: "Featured", render: (row) => (row as AdminJob).featured ? "Yes" : "No" },
      { key: "applications", label: "Applications", render: (row) => (row as AdminJob).applicationsCount },
      { key: "created", label: "Created", render: (row) => formatDate((row as AdminJob).createdAt) },
    ];
    if (section === "applications") return [
      { key: "candidate", label: "Candidate", render: (row) => { const application = row as AdminApplication; return <div className="min-w-[180px]"><p className="truncate font-semibold" title={application.candidateName}>{application.candidateName}</p><p className="truncate text-xs text-gray-500 dark:text-gray-400">{application.candidateEmail}</p></div>; } },
      { key: "job", label: "Job", render: (row) => <div className="min-w-[150px]"><p className="truncate font-semibold">{(row as AdminApplication).jobTitle}</p><p className="truncate text-xs text-gray-500 dark:text-gray-400">{(row as AdminApplication).companyName}</p></div> },
      { key: "status", label: "Status", render: (row) => <StatusPill value={(row as AdminApplication).status} /> },
      { key: "resume", label: "Resume", render: (row) => (row as AdminApplication).resumeAvailable ? "Available" : "Missing" },
      { key: "applied", label: "Applied", render: (row) => formatDate((row as AdminApplication).appliedAt) },
    ];
    if (section === "moderation") return [
      { key: "target", label: "Target", render: (row) => { const action = row as AdminModerationAction; return <div className="min-w-[190px]"><p className="truncate font-semibold" title={action.targetLabel}>{action.targetLabel}</p><p className="text-xs text-gray-500 dark:text-gray-400">{formatLabel(action.targetType)}</p></div>; } },
      { key: "action", label: "Action", render: (row) => <StatusPill value={(row as AdminModerationAction).actionType} /> },
      { key: "admin", label: "Admin", render: (row) => <span className="block max-w-[160px] truncate">{(row as AdminModerationAction).adminLabel}</span> },
      { key: "reason", label: "Reason", render: (row) => <span className="block max-w-[280px] truncate" title={(row as AdminModerationAction).reason}>{(row as AdminModerationAction).reason}</span> },
      { key: "date", label: "Date", render: (row) => formatDate((row as AdminModerationAction).createdAt) },
      { key: "state", label: "Reversal", render: (row) => (row as AdminModerationAction).reversedAt ? "Reversed" : "Active" },
    ];
    return [
      { key: "customer", label: "Customer", render: (row) => { const payment = row as AdminPayment; return <div className="min-w-[180px]"><p className="truncate font-semibold">{payment.recruiterName}</p><p className="truncate text-xs text-gray-500 dark:text-gray-400">{payment.recruiterEmail}</p></div>; } },
      { key: "plan", label: "Plan", render: (row) => (row as AdminPayment).planName },
      { key: "amount", label: "Amount", render: (row) => { const payment = row as AdminPayment; return `${payment.currency} ${payment.amount.toFixed(2)}`; } },
      { key: "status", label: "Payment status", render: (row) => <StatusPill value={(row as AdminPayment).status} /> },
      { key: "reference", label: "Reference", render: (row) => (row as AdminPayment).paymentReference ?? "Not available" },
      { key: "date", label: "Date", render: (row) => formatDate((row as AdminPayment).purchasedAt) },
    ];
  }, [section]);

  function submitFilters(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPage(1); setSubmittedFilters({ ...filters }); }
  function clearFilters() { setFilters(initialFilters); setSubmittedFilters(initialFilters); setPage(1); }

  async function handleLogout() { await logout(); }

  const isList = section !== "overview";
  return <AdminFrame section={section} onLogout={() => { void handleLogout(); }}>
    {loading && !overview && !isList ? <div className="h-48 animate-pulse rounded-2xl bg-[var(--skeleton)]" /> : null}
    {error && !isList ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-lg bg-black px-3 py-2 font-semibold text-white focus:outline-none focus:ring-4 focus:ring-yellow-300">Retry</button></div> : null}
    {!isList && !error && overview ? <Overview overview={overview} range={analyticsRange} onRangeChange={setAnalyticsRange} /> : null}
    {isList ? <div className="space-y-6">
      <div><h2 className="text-3xl font-bold tracking-tight">{sectionMeta[section].title}</h2><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{sectionMeta[section].description}</p></div>
      <form onSubmit={submitFilters} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-2 xl:grid-cols-4" role="search">
        <label className="grid gap-1.5 sm:col-span-2 xl:col-span-2"><span className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">Search</span><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder={section === "applications" ? "Candidate, job, or company" : "Search records"} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm outline-none focus:ring-4 focus:ring-yellow-300" /></label>
        {section === "users" ? <SelectFilter label="Role" value={filters.role} options={[["", "All roles"], ["recruiter", "Recruiter"], ["job_seeker", "Candidate"]]} onChange={(value) => setFilters((current) => ({ ...current, role: value }))} /> : null}
        {section === "companies" ? <SelectFilter label="Verification" value={filters.verification} options={[["", "All statuses"], ["verified", "Verified"], ["pending", "Pending"], ["unverified", "Unverified"], ["rejected", "Rejected"]]} onChange={(value) => setFilters((current) => ({ ...current, verification: value }))} /> : null}
        {section === "jobs" ? <><SelectFilter label="Status" value={filters.status} options={[["", "All statuses"], ["draft", "Draft"], ["pending", "Pending"], ["published", "Published"], ["closed", "Closed"], ["archived", "Archived"]]} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} /><SelectFilter label="Featured" value={filters.featured} options={[["", "All jobs"], ["true", "Featured"], ["false", "Not featured"]]} onChange={(value) => setFilters((current) => ({ ...current, featured: value }))} /></> : null}
        {section === "applications" ? <SelectFilter label="Status" value={filters.status} options={[["", "All statuses"], ["applied", "Applied"], ["reviewing", "Reviewing"], ["shortlisted", "Shortlisted"], ["interview", "Interview"], ["offered", "Offered"], ["hired", "Hired"], ["rejected", "Rejected"], ["withdrawn", "Withdrawn"]]} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} /> : null}
        {section === "payments" ? <><SelectFilter label="Status" value={filters.status} options={[["", "All statuses"], ["pending", "Pending"], ["paid", "Paid"], ["captured", "Captured"], ["failed", "Failed"], ["refunded", "Refunded"], ["cancelled", "Cancelled"]]} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} /><input aria-label="Plan slug filter" value={filters.plan} onChange={(event) => setFilters((current) => ({ ...current, plan: event.target.value }))} placeholder="Plan slug" className="h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm outline-none focus:ring-4 focus:ring-yellow-300" /></> : null}
        {section === "moderation" ? <><SelectFilter label="Target" value={filters.targetType} options={[["", "All targets"], ["user", "Users"], ["company", "Companies"], ["job", "Jobs"], ["application", "Applications"], ["payment", "Payments"]]} onChange={(value) => setFilters((current) => ({ ...current, targetType: value }))} /><SelectFilter label="Action" value={filters.actionType} options={[["", "All actions"], ["warn", "Warnings"], ["hide", "Hidden"], ["suspend", "Suspended"], ["restrict", "Restricted"], ["mark_spam", "Suspicious flags"], ["review", "Payment review"]]} onChange={(value) => setFilters((current) => ({ ...current, actionType: value }))} /><label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">From</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm outline-none focus:ring-4 focus:ring-yellow-300" /></label><label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">To</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm outline-none focus:ring-4 focus:ring-yellow-300" /></label></> : null}
        <SelectFilter label="Sort" value={filters.sort} options={section === "companies" ? [["newest", "Newest"], ["oldest", "Oldest"], ["completion", "Completion"]] : [["newest", "Newest"], ["oldest", "Oldest"]]} onChange={(value) => setFilters((current) => ({ ...current, sort: value }))} />
        <div className="flex items-end gap-2"><button type="submit" className="h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] focus:outline-none focus:ring-4 focus:ring-yellow-300">Apply filters</button><button type="button" onClick={clearFilters} className="h-10 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--muted)] focus:outline-none focus:ring-4 focus:ring-yellow-300">Clear</button></div>
      </form>
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]"><AdminTable columns={columns} error={error} getRowKey={(row) => row.id} loading={loading} onRetry={() => void load()} onRowClick={setSelected} rows={rows} /><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-4 text-sm"><span className="text-gray-500 dark:text-gray-400">{pagination.total} record{pagination.total === 1 ? "" : "s"}</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[var(--border)] px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-yellow-300">Previous</button><span>Page {pagination.totalPages ? page : 0} of {pagination.totalPages || 0}</span><button type="button" disabled={!pagination.totalPages || page >= pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[var(--border)] px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-yellow-300">Next</button></div></div></section>
    </div> : null}
    {selected ? <DetailDialog row={selected} section={section} onClose={() => setSelected(null)} onModerationComplete={() => void load()} /> : null}
  </AdminFrame>;
}

function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5"><span className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm outline-none focus:ring-4 focus:ring-yellow-300">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}
