import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminApplication,
  AdminAnalyticsRange,
  AdminAnalyticsSnapshot,
  AdminCompany,
  AdminJob,
  AdminListResponse,
  AdminModerationAction,
  AdminOverview,
  AdminPagination,
  AdminPayment,
  AdminUser,
} from "@/lib/admin-types";

type AdminClient = SupabaseClient;

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role_mode: string | null;
  profile_completed: boolean | null;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  moderation_status: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  industry: string | null;
  recruiter_id: string;
  verification_status: string;
  profile_completion: number | null;
  created_at: string | null;
  updated_at: string | null;
  moderation_status: string | null;
};

type JobRow = {
  id: string;
  title: string | null;
  slug: string | null;
  company_name: string | null;
  company_id: string | null;
  created_by: string | null;
  status: string | null;
  featured: boolean | null;
  applications_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  moderation_status: string | null;
};

type ApplicationRow = {
  id: string;
  job_id: string;
  candidate_id: string;
  status: string | null;
  resume_url: string | null;
  cover_letter: string | null;
  applied_at: string | null;
  updated_at: string | null;
  moderation_status: string | null;
};

type PaymentRow = {
  id: string;
  recruiter_id: string;
  plan_id: string;
  amount: number | string | null;
  currency: string | null;
  payment_provider: string | null;
  provider_payment_id: string | null;
  provider_order_id: string | null;
  payment_reference: string | null;
  status: string | null;
  purchased_at: string | null;
  subscription_id: string | null;
  moderation_status: string | null;
};

type PlanRow = { id: string; name: string; slug: string };
type SubscriptionRow = { id: string; status: string | null };

const defaultPageSize = 15;

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeSearch(value: string | null) {
  return (value ?? "")
    .replace(/[^a-zA-Z0-9._@ -]/g, "")
    .trim()
    .slice(0, 80);
}

function parsePage(value: string | null) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100000) : 1;
}

function parsePageSize(value: string | null) {
  const parsed = Number.parseInt(value ?? String(defaultPageSize), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : defaultPageSize;
}

function pagination(page: number, pageSize: number, total: number): AdminPagination {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

function nameOrFallback(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function mapUser(row: ProfileRow): AdminUser {
  return {
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    email: nameOrFallback(row.email, "No email").toLowerCase(),
    fullName: nameOrFallback(row.full_name, "Unnamed user"),
    id: row.id,
    profileCompleted: Boolean(row.profile_completed),
    role: nameOrFallback(row.role_mode, "unassigned"),
    moderationStatus: nameOrFallback(row.moderation_status, "active"),
    updatedAt: row.updated_at,
  };
}

function maskReference(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

async function getProfilesById(client: AdminClient, ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, ProfileRow>();

  const result = await client
    .from("profiles")
    .select("id, full_name, email, role_mode, profile_completed, avatar_url, created_at, updated_at, moderation_status")
    .in("id", uniqueIds);

  if (result.error) throw result.error;
  const rows = (result.data ?? []) as unknown as ProfileRow[];
  return new Map(rows.map((row) => [row.id, row]));
}

async function getJobsById(client: AdminClient, ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, JobRow>();

  const result = await client
    .from("jobs")
    .select("id, title, slug, company_name, company_id, created_by, status, featured, applications_count, created_at, updated_at, published_at, moderation_status")
    .in("id", uniqueIds);

  if (result.error) throw result.error;
  const rows = (result.data ?? []) as unknown as JobRow[];
  return new Map(rows.map((row) => [row.id, row]));
}

function mapJob(row: JobRow, profiles: Map<string, ProfileRow>): AdminJob {
  const recruiter = row.created_by ? profiles.get(row.created_by) : undefined;
  return {
    applicationsCount: Math.max(0, Math.round(finiteNumber(row.applications_count))),
    companyId: row.company_id,
    companyName: nameOrFallback(row.company_name, "Unknown company"),
    createdAt: row.created_at,
    featured: Boolean(row.featured),
    id: row.id,
    publishedAt: row.published_at,
    recruiterEmail: nameOrFallback(recruiter?.email, "No email"),
    recruiterName: nameOrFallback(recruiter?.full_name, "Unknown recruiter"),
    slug: row.slug,
    status: nameOrFallback(row.status, "unknown"),
    moderationStatus: nameOrFallback(row.moderation_status, "active"),
    title: nameOrFallback(row.title, "Untitled job"),
    updatedAt: row.updated_at,
  };
}

function mapApplication(
  row: ApplicationRow,
  jobs: Map<string, JobRow>,
  profiles: Map<string, ProfileRow>,
): AdminApplication {
  const job = jobs.get(row.job_id);
  const candidate = profiles.get(row.candidate_id);
  return {
    appliedAt: row.applied_at,
    candidateEmail: nameOrFallback(candidate?.email, "No email"),
    candidateName: nameOrFallback(candidate?.full_name, "Unknown candidate"),
    companyName: nameOrFallback(job?.company_name, "Unknown company"),
    coverLetterAvailable: Boolean(row.cover_letter?.trim()),
    id: row.id,
    jobTitle: nameOrFallback(job?.title, "Unknown job"),
    resumeAvailable: Boolean(row.resume_url),
    status: nameOrFallback(row.status, "unknown"),
    moderationStatus: nameOrFallback(row.moderation_status, "active"),
    updatedAt: row.updated_at,
  };
}

async function getJobList(
  client: AdminClient,
  search: string,
  status: string,
  featured: string,
  sort: string,
  page: number,
  pageSize: number,
) {
  let query = client
    .from("jobs")
    .select("id, title, slug, company_name, company_id, created_by, status, featured, applications_count, created_at, updated_at, published_at, moderation_status", { count: "exact" })
    .order("created_at", { ascending: sort === "oldest" })
    .order("id", { ascending: false });

  if (status) query = query.eq("status", status);
  if (featured === "true" || featured === "false") query = query.eq("featured", featured === "true");
  if (search) query = query.or(`title.ilike.%${search}%,company_name.ilike.%${search}%`);

  const from = (page - 1) * pageSize;
  const result = await query.range(from, from + pageSize - 1);
  if (result.error) throw result.error;
  const rows = (result.data ?? []) as unknown as JobRow[];
  const profiles = await getProfilesById(client, rows.map((row) => row.created_by ?? ""));
  return {
    data: rows.map((row) => mapJob(row, profiles)),
    pagination: pagination(page, pageSize, result.count ?? 0),
  } satisfies AdminListResponse<AdminJob>;
}

function normalizeAnalyticsRange(value: string | null): AdminAnalyticsRange {
  return value === "today" || value === "7d" || value === "30d" || value === "90d" ? value : "all";
}

export async function getAdminOverview(
  client: AdminClient,
  rangeValue: string | null,
): Promise<AdminOverview> {
  const range = normalizeAnalyticsRange(rangeValue);
  const snapshotResult = await client.rpc("get_admin_analytics_snapshot", { p_range: range });
  if (snapshotResult.error) throw snapshotResult.error;
  const analytics = snapshotResult.data as unknown as AdminAnalyticsSnapshot;

  const [recentUsers, recentCompanies, recentJobs, recentApplications, recentPayments] = await Promise.all([
    client.from("profiles").select("id, full_name, email, role_mode, profile_completed, avatar_url, created_at, updated_at, moderation_status").order("created_at", { ascending: false }).limit(5),
    client.from("companies").select("id, name, slug, logo_path, industry, recruiter_id, verification_status, profile_completion, created_at, updated_at, moderation_status").order("created_at", { ascending: false }).limit(5),
    client.from("jobs").select("id, title, slug, company_name, company_id, created_by, status, featured, applications_count, created_at, updated_at, published_at, moderation_status").order("created_at", { ascending: false }).limit(5),
    client.from("applications").select("id, job_id, candidate_id, status, resume_url, cover_letter, applied_at, updated_at, moderation_status").order("applied_at", { ascending: false }).limit(5),
    client.from("purchase_history").select("id, recruiter_id, plan_id, amount, currency, payment_provider, provider_payment_id, provider_order_id, payment_reference, status, purchased_at, subscription_id, moderation_status").in("status", ["paid", "captured"]).order("purchased_at", { ascending: false }).limit(5),
  ]);
  const recentFailure = [recentUsers, recentCompanies, recentJobs, recentApplications, recentPayments].find((item) => item.error);
  if (recentFailure?.error) throw recentFailure.error;

  const userRows = (recentUsers.data ?? []) as unknown as ProfileRow[];
  const companyRows = (recentCompanies.data ?? []) as unknown as CompanyRow[];
  const jobRows = (recentJobs.data ?? []) as unknown as JobRow[];
  const applicationRows = (recentApplications.data ?? []) as unknown as ApplicationRow[];
  const paymentRows = (recentPayments.data ?? []) as unknown as PaymentRow[];
  const profiles = await getProfilesById(client, [
    ...companyRows.map((row) => row.recruiter_id),
    ...jobRows.map((row) => row.created_by ?? ""),
    ...applicationRows.map((row) => row.candidate_id),
    ...paymentRows.map((row) => row.recruiter_id),
  ]);
  const recentApplicationJobs = await getJobsById(client, applicationRows.map((row) => row.job_id));
  const planIds = [...new Set(paymentRows.map((row) => row.plan_id))];
  const plansResult = planIds.length
    ? await client.from("plans").select("id, name, slug").in("id", planIds)
    : { data: [], error: null };
  if (plansResult.error) throw plansResult.error;
  const plans = new Map(((plansResult.data ?? []) as unknown as PlanRow[]).map((row) => [row.id, row]));
  const subscriptionIds = paymentRows.map((row) => row.subscription_id).filter((id): id is string => Boolean(id));
  const subscriptionsResult = subscriptionIds.length
    ? await client.from("subscriptions").select("id, status").in("id", subscriptionIds)
    : { data: [], error: null };
  if (subscriptionsResult.error) throw subscriptionsResult.error;
  const subscriptions = new Map(((subscriptionsResult.data ?? []) as unknown as SubscriptionRow[]).map((row) => [row.id, row]));

  return {
    counts: analytics.counts,
    analytics,
    recent: {
      users: userRows.map(mapUser),
      companies: companyRows.map((row) => mapCompany(row, profiles, new Map([[row.id, 0]]), new Map([[row.id, 0]]))),
      jobs: jobRows.map((row) => mapJob(row, profiles)),
      applications: applicationRows.map((row) => mapApplication(row, recentApplicationJobs, profiles)),
      payments: paymentRows.map((row) => mapPayment(row, profiles, plans, subscriptions)),
    },
  };
}

function mapCompany(
  row: CompanyRow,
  profiles: Map<string, ProfileRow>,
  activeCounts: Map<string, number>,
  totalCounts: Map<string, number>,
): AdminCompany {
  const owner = profiles.get(row.recruiter_id);
  return {
    activeJobCount: activeCounts.get(row.id) ?? 0,
    createdAt: row.created_at,
    id: row.id,
    industry: row.industry,
    logoPath: row.logo_path,
    name: nameOrFallback(row.name, "Unnamed company"),
    profileCompletion: Math.max(0, Math.min(100, Math.round(finiteNumber(row.profile_completion)))),
    recruiterEmail: nameOrFallback(owner?.email, "No email"),
    recruiterName: nameOrFallback(owner?.full_name, "Unknown owner"),
    slug: row.slug,
    totalJobCount: totalCounts.get(row.id) ?? 0,
    updatedAt: row.updated_at,
    verificationStatus: nameOrFallback(row.verification_status, "unknown"),
    moderationStatus: nameOrFallback(row.moderation_status, "active"),
  };
}

async function getCompanyList(client: AdminClient, search: string, verification: string, sort: string, page: number, pageSize: number) {
  let query = client
    .from("companies")
    .select("id, name, slug, logo_path, industry, recruiter_id, verification_status, profile_completion, created_at, updated_at, moderation_status", { count: "exact" })
    .order(sort === "completion" ? "profile_completion" : "created_at", { ascending: sort === "oldest" })
    .order("id", { ascending: false });
  if (search) query = query.or(`name.ilike.%${search}%,industry.ilike.%${search}%`);
  if (verification) query = query.eq("verification_status", verification);
  const from = (page - 1) * pageSize;
  const result = await query.range(from, from + pageSize - 1);
  if (result.error) throw result.error;
  const rows = (result.data ?? []) as unknown as CompanyRow[];
  const ids = rows.map((row) => row.id);
  const profiles = await getProfilesById(client, rows.map((row) => row.recruiter_id));
  const [activeResult, totalResult] = ids.length
    ? await Promise.all([
        client.from("jobs").select("company_id").in("company_id", ids).eq("status", "published"),
        client.from("jobs").select("company_id").in("company_id", ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (activeResult.error || totalResult.error) throw activeResult.error ?? totalResult.error;
  const activeCounts = new Map<string, number>();
  const totalCounts = new Map<string, number>();
  for (const row of (activeResult.data ?? []) as { company_id: string | null }[]) if (row.company_id) activeCounts.set(row.company_id, (activeCounts.get(row.company_id) ?? 0) + 1);
  for (const row of (totalResult.data ?? []) as { company_id: string | null }[]) if (row.company_id) totalCounts.set(row.company_id, (totalCounts.get(row.company_id) ?? 0) + 1);
  return {
    data: rows.map((row) => mapCompany(row, profiles, activeCounts, totalCounts)),
    pagination: pagination(page, pageSize, result.count ?? 0),
  } satisfies AdminListResponse<AdminCompany>;
}

async function getUserList(client: AdminClient, search: string, role: string, sort: string, page: number, pageSize: number) {
  let query = client
    .from("profiles")
    .select("id, full_name, email, role_mode, profile_completed, avatar_url, created_at, updated_at, moderation_status", { count: "exact" })
    .order("created_at", { ascending: sort !== "oldest" })
    .order("id", { ascending: false });
  if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  if (role) query = query.eq("role_mode", role);
  const from = (page - 1) * pageSize;
  const result = await query.range(from, from + pageSize - 1);
  if (result.error) throw result.error;
  return {
    data: ((result.data ?? []) as unknown as ProfileRow[]).map(mapUser),
    pagination: pagination(page, pageSize, result.count ?? 0),
  } satisfies AdminListResponse<AdminUser>;
}

function mapPayment(row: PaymentRow, profiles: Map<string, ProfileRow>, plans: Map<string, PlanRow>, subscriptions: Map<string, SubscriptionRow>): AdminPayment {
  const owner = profiles.get(row.recruiter_id);
  return {
    amount: Math.max(0, finiteNumber(row.amount)),
    currency: nameOrFallback(row.currency, "USD"),
    id: row.id,
    orderReference: maskReference(row.provider_order_id),
    paymentReference: maskReference(row.payment_reference ?? row.provider_payment_id),
    planName: plans.get(row.plan_id)?.name ?? "Plan unavailable",
    purchasedAt: row.purchased_at,
    recruiterEmail: nameOrFallback(owner?.email, "No email"),
    recruiterName: nameOrFallback(owner?.full_name, "Unknown recruiter"),
    status: nameOrFallback(row.status, "unknown"),
    moderationStatus: nameOrFallback(row.moderation_status, "clear"),
    subscriptionStatus: row.subscription_id ? subscriptions.get(row.subscription_id)?.status ?? null : null,
  };
}

async function getPaymentList(client: AdminClient, search: string, status: string, planSlug: string, sort: string, page: number, pageSize: number) {
  let planIds: string[] = [];
  if (planSlug) {
    const planResult = await client.from("plans").select("id").eq("slug", planSlug).maybeSingle();
    if (planResult.error) throw planResult.error;
    if (!planResult.data) return { data: [], pagination: pagination(page, pageSize, 0) } satisfies AdminListResponse<AdminPayment>;
    planIds = [(planResult.data as { id: string }).id];
  }

  let searchRecruiterIds: string[] = [];
  if (search) {
    const searchResult = await client.from("profiles").select("id").or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    if (searchResult.error) throw searchResult.error;
    searchRecruiterIds = ((searchResult.data ?? []) as { id: string }[]).map((row) => row.id);
  }

  let query = client
    .from("purchase_history")
    .select("id, recruiter_id, plan_id, amount, currency, payment_provider, provider_payment_id, provider_order_id, payment_reference, status, purchased_at, subscription_id, moderation_status", { count: "exact" })
    .order("purchased_at", { ascending: sort === "oldest" })
    .order("id", { ascending: false });
  if (status) query = query.eq("status", status);
  if (planIds.length) query = query.in("plan_id", planIds);
  if (search) {
    const fragments = [`payment_reference.ilike.%${search}%`, `provider_payment_id.ilike.%${search}%`, `provider_order_id.ilike.%${search}%`];
    if (searchRecruiterIds.length) fragments.push(`recruiter_id.in.(${searchRecruiterIds.join(",")})`);
    query = query.or(fragments.join(","));
  }
  const from = (page - 1) * pageSize;
  const result = await query.range(from, from + pageSize - 1);
  if (result.error) throw result.error;
  const rows = (result.data ?? []) as unknown as PaymentRow[];
  const profiles = await getProfilesById(client, rows.map((row) => row.recruiter_id));
  const ids = [...new Set(rows.map((row) => row.plan_id))];
  const plansResult = ids.length ? await client.from("plans").select("id, name, slug").in("id", ids) : { data: [], error: null };
  if (plansResult.error) throw plansResult.error;
  const plans = new Map(((plansResult.data ?? []) as unknown as PlanRow[]).map((row) => [row.id, row]));
  const subscriptionIds = rows.map((row) => row.subscription_id).filter((id): id is string => Boolean(id));
  const subscriptionsResult = subscriptionIds.length ? await client.from("subscriptions").select("id, status").in("id", subscriptionIds) : { data: [], error: null };
  if (subscriptionsResult.error) throw subscriptionsResult.error;
  const subscriptions = new Map(((subscriptionsResult.data ?? []) as unknown as SubscriptionRow[]).map((row) => [row.id, row]));
  return {
    data: rows.map((row) => mapPayment(row, profiles, plans, subscriptions)),
    pagination: pagination(page, pageSize, result.count ?? 0),
  } satisfies AdminListResponse<AdminPayment>;
}

async function getApplicationList(client: AdminClient, search: string, status: string, sort: string, page: number, pageSize: number) {
  let candidateIds: string[] = [];
  let jobIds: string[] = [];
  if (search) {
    const [profilesResult, jobsResult] = await Promise.all([
      client.from("profiles").select("id").or(`full_name.ilike.%${search}%,email.ilike.%${search}%`),
      client.from("jobs").select("id").or(`title.ilike.%${search}%,company_name.ilike.%${search}%`),
    ]);
    if (profilesResult.error || jobsResult.error) throw profilesResult.error ?? jobsResult.error;
    candidateIds = ((profilesResult.data ?? []) as { id: string }[]).map((row) => row.id);
    jobIds = ((jobsResult.data ?? []) as { id: string }[]).map((row) => row.id);
    if (candidateIds.length === 0 && jobIds.length === 0) return { data: [], pagination: pagination(page, pageSize, 0) } satisfies AdminListResponse<AdminApplication>;
  }
  let query = client
    .from("applications")
    .select("id, job_id, candidate_id, status, resume_url, cover_letter, applied_at, updated_at, moderation_status", { count: "exact" })
    .order("applied_at", { ascending: sort === "oldest" })
    .order("id", { ascending: false });
  if (status) query = query.eq("status", status);
  if (search) {
    const fragments = [] as string[];
    if (candidateIds.length) fragments.push(`candidate_id.in.(${candidateIds.join(",")})`);
    if (jobIds.length) fragments.push(`job_id.in.(${jobIds.join(",")})`);
    query = query.or(fragments.join(","));
  }
  const from = (page - 1) * pageSize;
  const result = await query.range(from, from + pageSize - 1);
  if (result.error) throw result.error;
  const rows = (result.data ?? []) as unknown as ApplicationRow[];
  const [jobs, profiles] = await Promise.all([
    getJobsById(client, rows.map((row) => row.job_id)),
    getProfilesById(client, rows.map((row) => row.candidate_id)),
  ]);
  return {
    data: rows.map((row) => mapApplication(row, jobs, profiles)),
    pagination: pagination(page, pageSize, result.count ?? 0),
  } satisfies AdminListResponse<AdminApplication>;
}

export async function getAdminUsers(client: AdminClient, params: URLSearchParams) {
  return getUserList(client, safeSearch(params.get("search")), params.get("role") ?? "", params.get("sort") ?? "newest", parsePage(params.get("page")), parsePageSize(params.get("pageSize")));
}

export async function getAdminCompanies(client: AdminClient, params: URLSearchParams) {
  return getCompanyList(client, safeSearch(params.get("search")), params.get("verification") ?? "", params.get("sort") ?? "newest", parsePage(params.get("page")), parsePageSize(params.get("pageSize")));
}

export async function getAdminJobs(client: AdminClient, params: URLSearchParams) {
  return getJobList(client, safeSearch(params.get("search")), params.get("status") ?? "", params.get("featured") ?? "", params.get("sort") ?? "newest", parsePage(params.get("page")), parsePageSize(params.get("pageSize")));
}

export async function getAdminApplications(client: AdminClient, params: URLSearchParams) {
  return getApplicationList(client, safeSearch(params.get("search")), params.get("status") ?? "", params.get("sort") ?? "newest", parsePage(params.get("page")), parsePageSize(params.get("pageSize")));
}

export async function getAdminPayments(client: AdminClient, params: URLSearchParams) {
  return getPaymentList(client, safeSearch(params.get("search")), params.get("status") ?? "", params.get("plan") ?? "", params.get("sort") ?? "newest", parsePage(params.get("page")), parsePageSize(params.get("pageSize")));
}

function moderationTargetLabel(value: string | null | undefined) {
  return nameOrFallback(value, "Unknown target");
}

export async function getAdminModeration(client: AdminClient, params: URLSearchParams) {
  const search = safeSearch(params.get("search"));
  const targetType = params.get("targetType") ?? "";
  const actionType = params.get("actionType") ?? "";
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  const page = parsePage(params.get("page"));
  const pageSize = parsePageSize(params.get("pageSize"));
  let query = client
    .from("moderation_actions")
    .select("id, admin_id, target_type, target_id, action_type, reason, internal_note, previous_state, new_state, created_at, reversed_at, reversed_by", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (targetType) query = query.eq("target_type", targetType);
  if (actionType) query = query.eq("action_type", actionType);
  if (search) query = query.or(`reason.ilike.%${search}%,internal_note.ilike.%${search}%`);
  if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    const end = new Date(`${dateTo}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    query = query.lt("created_at", end.toISOString());
  }
  const from = (page - 1) * pageSize;
  const result = await query.range(from, from + pageSize - 1);
  if (result.error) throw result.error;
  const rawRows = (result.data ?? []) as Array<{
    id: string;
    admin_id: string;
    target_type: AdminModerationAction["targetType"];
    target_id: string;
    action_type: string;
    reason: string;
    internal_note: string;
    previous_state: Record<string, unknown>;
    new_state: Record<string, unknown>;
    created_at: string;
    reversed_at: string | null;
    reversed_by: string | null;
  }>;
  const targetMaps = new Map<string, string>();
  const idsByType = new Map<string, string[]>();
  for (const row of rawRows) {
    const values = idsByType.get(row.target_type) ?? [];
    values.push(row.target_id);
    idsByType.set(row.target_type, values);
  }
  const userIds = idsByType.get("user") ?? [];
  const companyIds = idsByType.get("company") ?? [];
  const jobIds = idsByType.get("job") ?? [];
  const applicationIds = idsByType.get("application") ?? [];
  const paymentIds = idsByType.get("payment") ?? [];
  const adminProfiles = await getProfilesById(client, rawRows.map((row) => row.admin_id));
  const [users, companies, jobs, applications, payments] = await Promise.all([
    userIds.length ? client.from("profiles").select("id, full_name, email").in("id", userIds) : { data: [], error: null },
    companyIds.length ? client.from("companies").select("id, name").in("id", companyIds) : { data: [], error: null },
    jobIds.length ? client.from("jobs").select("id, title, company_name").in("id", jobIds) : { data: [], error: null },
    applicationIds.length ? client.from("applications").select("id, job_id, candidate_id").in("id", applicationIds) : { data: [], error: null },
    paymentIds.length ? client.from("purchase_history").select("id, payment_reference, provider_payment_id").in("id", paymentIds) : { data: [], error: null },
  ]);
  const lookupFailures = [users, companies, jobs, applications, payments].find((item) => item.error);
  if (lookupFailures?.error) throw lookupFailures.error;
  for (const row of (users.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) targetMaps.set(`user:${row.id}`, `${moderationTargetLabel(row.full_name)} (${moderationTargetLabel(row.email)})`);
  for (const row of (companies.data ?? []) as Array<{ id: string; name: string | null }>) targetMaps.set(`company:${row.id}`, moderationTargetLabel(row.name));
  for (const row of (jobs.data ?? []) as Array<{ id: string; title: string | null; company_name: string | null }>) targetMaps.set(`job:${row.id}`, `${moderationTargetLabel(row.title)} · ${moderationTargetLabel(row.company_name)}`);
  for (const row of (applications.data ?? []) as Array<{ id: string; job_id: string }>) targetMaps.set(`application:${row.id}`, `Application ${row.id.slice(0, 8)} · Job ${row.job_id.slice(0, 8)}`);
  for (const row of (payments.data ?? []) as Array<{ id: string; payment_reference: string | null; provider_payment_id: string | null }>) targetMaps.set(`payment:${row.id}`, moderationTargetLabel(row.payment_reference ?? row.provider_payment_id));
  return {
    data: rawRows.map((row) => ({
      actionType: row.action_type,
      adminId: row.admin_id,
      adminLabel: nameOrFallback(adminProfiles.get(row.admin_id)?.full_name ?? adminProfiles.get(row.admin_id)?.email, "Admin"),
      createdAt: row.created_at,
      id: row.id,
      internalNote: row.internal_note,
      newState: row.new_state ?? {},
      previousState: row.previous_state ?? {},
      reason: row.reason,
      reversedAt: row.reversed_at,
      reversedBy: row.reversed_by,
      targetId: row.target_id,
      targetLabel: targetMaps.get(`${row.target_type}:${row.target_id}`) ?? `Unknown ${row.target_type}`,
      targetType: row.target_type,
    } satisfies AdminModerationAction)),
    pagination: pagination(page, pageSize, result.count ?? 0),
  } satisfies AdminListResponse<AdminModerationAction>;
}
