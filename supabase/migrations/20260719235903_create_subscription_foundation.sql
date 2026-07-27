begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(12, 2) not null default 0,
  currency char(3) not null default 'USD',
  billing_type text not null default 'lifetime',
  duration_days integer,
  job_post_limit integer,
  featured_job_limit integer,
  priority_support boolean not null default false,
  resume_database_access boolean not null default false,
  active boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_name_length_check
    check (char_length(trim(name)) between 1 and 120),
  constraint plans_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint plans_price_check
    check (price >= 0),
  constraint plans_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint plans_billing_type_check
    check (billing_type in ('lifetime', 'one_time', 'monthly', 'yearly', 'enterprise')),
  constraint plans_duration_check
    check (duration_days is null or duration_days > 0),
  constraint plans_job_post_limit_check
    check (job_post_limit is null or job_post_limit >= 0),
  constraint plans_featured_job_limit_check
    check (featured_job_limit is null or featured_job_limit >= 0)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  payment_id text,
  status text not null default 'pending',
  starts_at timestamptz,
  expires_at timestamptz,
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_check
    check (status in ('pending', 'active', 'expired', 'cancelled', 'lifetime')),
  constraint subscriptions_dates_check
    check (expires_at is null or starts_at is null or expires_at >= starts_at),
  constraint subscriptions_lifetime_expiry_check
    check (status <> 'lifetime' or expires_at is null)
);

create table if not exists public.purchase_history (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount numeric(12, 2) not null default 0,
  currency char(3) not null default 'USD',
  payment_provider text,
  payment_reference text,
  status text not null default 'pending',
  purchased_at timestamptz not null default now(),
  refunded_at timestamptz,
  refund_reference text,
  metadata jsonb not null default '{}'::jsonb,
  constraint purchase_history_amount_check
    check (amount >= 0),
  constraint purchase_history_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint purchase_history_status_check
    check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  constraint purchase_history_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.plan_usage (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_id uuid not null references public.plans(id) on delete restrict,
  period_start timestamptz not null default now(),
  period_end timestamptz,
  jobs_posted integer not null default 0,
  featured_jobs_used integer not null default 0,
  remaining_jobs integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_usage_period_check
    check (period_end is null or period_end >= period_start),
  constraint plan_usage_jobs_posted_check
    check (jobs_posted >= 0),
  constraint plan_usage_featured_jobs_check
    check (featured_jobs_used >= 0),
  constraint plan_usage_remaining_jobs_check
    check (remaining_jobs is null or remaining_jobs >= 0),
  constraint plan_usage_period_unique
    unique (recruiter_id, period_start)
);

create unique index if not exists subscriptions_recruiter_current_unique_idx
  on public.subscriptions (recruiter_id)
  where status in ('active', 'lifetime');

create index if not exists subscriptions_recruiter_status_purchased_idx
  on public.subscriptions (recruiter_id, status, purchased_at desc, id desc);

create index if not exists subscriptions_plan_status_idx
  on public.subscriptions (plan_id, status);

create index if not exists purchase_history_recruiter_purchased_idx
  on public.purchase_history (recruiter_id, purchased_at desc, id desc);

create index if not exists purchase_history_status_purchased_idx
  on public.purchase_history (status, purchased_at desc, id desc);

create index if not exists plan_usage_recruiter_period_idx
  on public.plan_usage (recruiter_id, period_start desc, id desc);

create index if not exists plan_usage_subscription_idx
  on public.plan_usage (subscription_id)
  where subscription_id is not null;

insert into public.plans (
  name,
  slug,
  description,
  price,
  currency,
  billing_type,
  duration_days,
  job_post_limit,
  featured_job_limit,
  priority_support,
  resume_database_access,
  active,
  display_order
)
values
  ('Free', 'free', 'A free recruiter account without publishing access.', 0, 'USD', 'lifetime', null, 0, 0, false, false, true, 0),
  ('Starter', 'starter', 'Post one job and review candidates manually.', 49, 'USD', 'lifetime', null, 1, 0, false, false, true, 10),
  ('Growth', 'growth', 'Post more jobs as your hiring needs grow.', 99, 'USD', 'lifetime', null, 5, 0, true, false, true, 20),
  ('Pro', 'pro', 'Unlimited job posts for active hiring teams.', 299, 'USD', 'lifetime', null, null, null, true, true, true, 30),
  ('Enterprise', 'enterprise', 'Reserved for future enterprise hiring infrastructure.', 0, 'USD', 'enterprise', null, null, null, true, true, false, 100)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  currency = excluded.currency,
  billing_type = excluded.billing_type,
  duration_days = excluded.duration_days,
  job_post_limit = excluded.job_post_limit,
  featured_job_limit = excluded.featured_job_limit,
  priority_support = excluded.priority_support,
  resume_database_access = excluded.resume_database_access,
  active = excluded.active,
  display_order = excluded.display_order,
  updated_at = now();

create or replace function public.set_subscription_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.set_subscription_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_subscription_updated_at();

drop trigger if exists plan_usage_set_updated_at on public.plan_usage;
create trigger plan_usage_set_updated_at
before update on public.plan_usage
for each row execute function public.set_subscription_updated_at();

create or replace function public.is_admin_actor()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'super_admin');
$$;

create or replace function public.get_my_subscription_snapshot()
returns table (
  role_mode text,
  plan_id uuid,
  plan_slug text,
  plan_name text,
  plan_description text,
  plan_price numeric,
  plan_currency char(3),
  billing_type text,
  duration_days integer,
  job_post_limit integer,
  featured_job_limit integer,
  priority_support boolean,
  resume_database_access boolean,
  subscription_id uuid,
  subscription_status text,
  subscription_starts_at timestamptz,
  subscription_expires_at timestamptz,
  jobs_posted integer,
  featured_jobs_used integer,
  remaining_jobs integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with current_profile as (
    select profiles.id, profiles.role_mode, profiles.current_plan
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role_mode = 'recruiter'
      and profiles.profile_completed = true
  ),
  current_subscription as (
    select
      subscriptions.id,
      subscriptions.plan_id,
      subscriptions.status,
      subscriptions.starts_at,
      subscriptions.expires_at,
      subscriptions.purchased_at
    from public.subscriptions
    inner join current_profile
      on current_profile.id = subscriptions.recruiter_id
    where subscriptions.status in ('active', 'lifetime')
      and (subscriptions.expires_at is null or subscriptions.expires_at > now())
    order by subscriptions.purchased_at desc nulls last, subscriptions.created_at desc, subscriptions.id desc
    limit 1
  ),
  selected_plan as (
    select plans.*
    from public.plans
    left join current_subscription
      on current_subscription.plan_id = plans.id
    left join current_profile
      on current_profile.current_plan = plans.slug
    where current_subscription.id is not null
      or plans.slug = coalesce((select current_plan from current_profile), 'free')
    order by (current_subscription.id is not null) desc, plans.active desc, plans.display_order
    limit 1
  ),
  selected_usage as (
    select
      plan_usage.jobs_posted,
      plan_usage.featured_jobs_used,
      plan_usage.remaining_jobs
    from public.plan_usage
    inner join current_profile
      on current_profile.id = plan_usage.recruiter_id
    left join current_subscription
      on current_subscription.id = plan_usage.subscription_id
    where current_subscription.id is not null
      or plan_usage.subscription_id is null
    order by
      (current_subscription.id is not null) desc,
      plan_usage.period_start desc,
      plan_usage.id desc
    limit 1
  )
  select
    current_profile.role_mode,
    selected_plan.id,
    selected_plan.slug,
    selected_plan.name,
    selected_plan.description,
    selected_plan.price,
    selected_plan.currency,
    selected_plan.billing_type,
    selected_plan.duration_days,
    selected_plan.job_post_limit,
    selected_plan.featured_job_limit,
    selected_plan.priority_support,
    selected_plan.resume_database_access,
    current_subscription.id,
    current_subscription.status,
    current_subscription.starts_at,
    current_subscription.expires_at,
    coalesce(selected_usage.jobs_posted, 0),
    coalesce(selected_usage.featured_jobs_used, 0),
    selected_usage.remaining_jobs
  from current_profile
  inner join selected_plan on true
  left join current_subscription on true
  left join selected_usage on true;
$$;

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.purchase_history enable row level security;
alter table public.plan_usage enable row level security;

revoke all on public.plans from public, anon, authenticated;
revoke all on public.subscriptions from public, anon, authenticated;
revoke all on public.purchase_history from public, anon, authenticated;
revoke all on public.plan_usage from public, anon, authenticated;

grant select on public.plans to anon, authenticated;
grant select on public.subscriptions, public.purchase_history, public.plan_usage to authenticated;
grant insert, update, delete on public.plans to authenticated;
grant insert, update, delete on public.subscriptions, public.purchase_history, public.plan_usage to authenticated;

drop policy if exists "Anyone can read active plans" on public.plans;
create policy "Anyone can read active plans"
  on public.plans for select
  to anon, authenticated
  using (active or public.is_admin_actor());

drop policy if exists "Admins can manage plans" on public.plans;
create policy "Admins can manage plans"
  on public.plans for all
  to authenticated
  using (public.is_admin_actor())
  with check (public.is_admin_actor());

drop policy if exists "Owners can read subscriptions" on public.subscriptions;
create policy "Owners can read subscriptions"
  on public.subscriptions for select
  to authenticated
  using (recruiter_id = auth.uid() or public.is_admin_actor());

drop policy if exists "Admins can manage subscriptions" on public.subscriptions;
create policy "Admins can manage subscriptions"
  on public.subscriptions for all
  to authenticated
  using (public.is_admin_actor())
  with check (public.is_admin_actor());

drop policy if exists "Owners can read purchase history" on public.purchase_history;
create policy "Owners can read purchase history"
  on public.purchase_history for select
  to authenticated
  using (recruiter_id = auth.uid() or public.is_admin_actor());

drop policy if exists "Admins can manage purchase history" on public.purchase_history;
create policy "Admins can manage purchase history"
  on public.purchase_history for all
  to authenticated
  using (public.is_admin_actor())
  with check (public.is_admin_actor());

drop policy if exists "Owners can read plan usage" on public.plan_usage;
create policy "Owners can read plan usage"
  on public.plan_usage for select
  to authenticated
  using (recruiter_id = auth.uid() or public.is_admin_actor());

drop policy if exists "Admins can manage plan usage" on public.plan_usage;
create policy "Admins can manage plan usage"
  on public.plan_usage for all
  to authenticated
  using (public.is_admin_actor())
  with check (public.is_admin_actor());

revoke all on function public.set_subscription_updated_at() from public, anon, authenticated;
revoke all on function public.is_admin_actor() from public, anon, authenticated;
grant execute on function public.is_admin_actor() to anon, authenticated;
revoke all on function public.get_my_subscription_snapshot() from public, anon, authenticated;
grant execute on function public.get_my_subscription_snapshot() to authenticated;

comment on table public.plans is
  'Central subscription plan catalog. The enterprise row is inactive until its commercial terms are configured.';
comment on table public.subscriptions is
  'Recruiter subscription state. Payment activation is intentionally handled by a future trusted server workflow.';
comment on table public.purchase_history is
  'Immutable purchase and future refund ledger for recruiter plans.';
comment on table public.plan_usage is
  'Materialized recruiter plan counters used instead of counting jobs on every request.';
comment on function public.get_my_subscription_snapshot() is
  'Owner-safe current recruiter plan and materialized usage snapshot for subscription access checks.';

notify pgrst, 'reload schema';

commit;
