begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.jobs
  add column if not exists last_viewed_at timestamptz,
  add column if not exists views_count bigint,
  add column if not exists applications_count bigint;

alter table public.jobs
  alter column views_count set default 0,
  alter column applications_count set default 0;

update public.jobs
set
  views_count = coalesce(views_count, 0),
  applications_count = coalesce(applications_count, 0)
where views_count is null
  or applications_count is null;

create table if not exists public.job_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  metric_date date not null,
  views_count integer not null default 0,
  applications_count integer not null default 0,
  apply_clicks_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_daily_metrics_views_count_check
    check (views_count >= 0),
  constraint job_daily_metrics_applications_count_check
    check (applications_count >= 0),
  constraint job_daily_metrics_apply_clicks_count_check
    check (apply_clicks_count >= 0)
);

alter table public.job_daily_metrics
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists job_id uuid,
  add column if not exists metric_date date,
  add column if not exists views_count integer default 0,
  add column if not exists applications_count integer default 0,
  add column if not exists apply_clicks_count integer default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.job_daily_metrics
set
  id = coalesce(id, gen_random_uuid()),
  views_count = coalesce(views_count, 0),
  applications_count = coalesce(applications_count, 0),
  apply_clicks_count = coalesce(apply_clicks_count, 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where id is null
  or views_count is null
  or applications_count is null
  or apply_clicks_count is null
  or created_at is null
  or updated_at is null;

alter table public.job_daily_metrics
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column views_count set default 0,
  alter column views_count set not null,
  alter column applications_count set default 0,
  alter column applications_count set not null,
  alter column apply_clicks_count set default 0,
  alter column apply_clicks_count set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_daily_metrics'::regclass
      and conname = 'job_daily_metrics_job_id_fkey'
  ) then
    alter table public.job_daily_metrics
      add constraint job_daily_metrics_job_id_fkey
      foreign key (job_id)
      references public.jobs(id)
      on delete cascade
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from public.job_daily_metrics
    where job_id is null
  ) then
    alter table public.job_daily_metrics
      alter column job_id set not null;
    alter table public.job_daily_metrics
      validate constraint job_daily_metrics_job_id_fkey;
  end if;

  if not exists (
    select 1
    from public.job_daily_metrics
    where metric_date is null
  ) then
    alter table public.job_daily_metrics
      alter column metric_date set not null;
  end if;
end $$;

create unique index if not exists job_daily_metrics_id_key
  on public.job_daily_metrics (id);

create unique index if not exists job_daily_metrics_job_id_metric_date_key
  on public.job_daily_metrics (job_id, metric_date);

create index if not exists job_daily_metrics_job_id_idx
  on public.job_daily_metrics (job_id);

create index if not exists job_daily_metrics_metric_date_idx
  on public.job_daily_metrics (metric_date desc);

create index if not exists job_daily_metrics_job_id_metric_date_idx
  on public.job_daily_metrics (job_id, metric_date desc);

create index if not exists jobs_owner_analytics_idx
  on public.jobs (
    created_by,
    status,
    views_count desc,
    applications_count desc,
    updated_at desc
  );

create index if not exists jobs_public_view_tracking_idx
  on public.jobs (slug, status, publish_at, expires_at)
  where status = 'published';

drop trigger if exists set_job_daily_metrics_updated_at_before_write
  on public.job_daily_metrics;

drop function if exists public.set_job_daily_metrics_updated_at();

alter table public.job_daily_metrics enable row level security;

revoke all on public.job_daily_metrics from public;
revoke all on public.job_daily_metrics from anon;
revoke all on public.job_daily_metrics from authenticated;
grant select on public.job_daily_metrics to authenticated;

drop policy if exists "Recruiters can read metrics for their own jobs"
  on public.job_daily_metrics;

create policy "Recruiters can read metrics for their own jobs"
  on public.job_daily_metrics
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.jobs
      join public.profiles
        on profiles.id = auth.uid()
      where jobs.id = job_daily_metrics.job_id
        and jobs.created_by = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    )
  );

create or replace function public.track_public_job_view(job_slug text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tracked_job_id uuid;
  metric_day date := (now() at time zone 'utc')::date;
begin
  select id
  into tracked_job_id
  from public.jobs
  where slug = job_slug
    and status = 'published'
    and published_at is not null
    and (publish_at is null or publish_at <= now())
    and (expires_at is null or expires_at > now())
  limit 1;

  if tracked_job_id is null then
    return false;
  end if;

  update public.jobs
  set
    views_count = coalesce(views_count, 0) + 1,
    last_viewed_at = now(),
    updated_at = now()
  where id = tracked_job_id;

  insert into public.job_daily_metrics (
    job_id,
    metric_date,
    views_count
  )
  values (
    tracked_job_id,
    metric_day,
    1
  )
  on conflict (job_id, metric_date)
  do update
  set
    views_count = public.job_daily_metrics.views_count + 1,
    updated_at = now();

  return true;
end;
$$;

create or replace function public.record_job_application_metric(target_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  metric_day date := (now() at time zone 'utc')::date;
  updated_job_id uuid;
begin
  update public.jobs
  set
    applications_count = coalesce(applications_count, 0) + 1,
    updated_at = now()
  where id = target_job_id
  returning id into updated_job_id;

  if updated_job_id is null then
    return false;
  end if;

  insert into public.job_daily_metrics (
    job_id,
    metric_date,
    applications_count
  )
  values (
    updated_job_id,
    metric_day,
    1
  )
  on conflict (job_id, metric_date)
  do update
  set
    applications_count = public.job_daily_metrics.applications_count + 1,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.track_public_job_view(text) from public;
revoke all on function public.track_public_job_view(text) from anon;
revoke all on function public.track_public_job_view(text) from authenticated;
grant execute on function public.track_public_job_view(text) to service_role;

revoke all on function public.record_job_application_metric(uuid) from public;
revoke all on function public.record_job_application_metric(uuid) from anon;
revoke all on function public.record_job_application_metric(uuid) from authenticated;
grant execute on function public.record_job_application_metric(uuid) to service_role;

comment on table public.job_daily_metrics is
  'Daily per-job analytics rollup. Recruiters can read metrics for their own jobs; service-role workflows write metrics.';

comment on column public.job_daily_metrics.id is
  'Stable primary identifier for each daily metrics row.';

comment on column public.job_daily_metrics.job_id is
  'Job that owns this daily analytics row.';

comment on column public.job_daily_metrics.metric_date is
  'UTC calendar day for the rollup.';

comment on column public.jobs.last_viewed_at is
  'Most recent counted public view timestamp for recruiter analytics.';

comment on function public.track_public_job_view(text) is
  'Service-role only RPC that counts a view for a currently public published job.';

comment on function public.record_job_application_metric(uuid) is
  'Service-role only future integration point for the Applications module.';

commit;

notify pgrst, 'reload schema';

select
  'job_daily_metrics_verification' as verification,
  to_regclass('public.job_daily_metrics') as metrics_table,
  count(*) as metric_rows
from public.job_daily_metrics;
