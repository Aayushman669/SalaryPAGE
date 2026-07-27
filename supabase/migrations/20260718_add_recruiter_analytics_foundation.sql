begin;

alter table public.jobs
  add column if not exists last_viewed_at timestamptz;

alter table public.jobs
  alter column views_count set default 0,
  alter column applications_count set default 0;

update public.jobs
set
  views_count = coalesce(views_count, 0),
  applications_count = coalesce(applications_count, 0)
where views_count is null
  or applications_count is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and conname = 'jobs_views_count_check'
  ) then
    alter table public.jobs
      add constraint jobs_views_count_check
      check (views_count >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and conname = 'jobs_applications_count_check'
  ) then
    alter table public.jobs
      add constraint jobs_applications_count_check
      check (applications_count >= 0) not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from public.jobs
    where views_count is null
      or views_count < 0
  ) then
    alter table public.jobs validate constraint jobs_views_count_check;
    alter table public.jobs alter column views_count set not null;
  end if;

  if not exists (
    select 1
    from public.jobs
    where applications_count is null
      or applications_count < 0
  ) then
    alter table public.jobs validate constraint jobs_applications_count_check;
    alter table public.jobs alter column applications_count set not null;
  end if;
end $$;

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

create table if not exists public.job_daily_metrics (
  job_id uuid not null references public.jobs(id) on delete cascade,
  metric_date date not null,
  views_count bigint not null default 0,
  applications_count bigint not null default 0,
  apply_clicks_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (job_id, metric_date),
  constraint job_daily_metrics_views_count_check
    check (views_count >= 0),
  constraint job_daily_metrics_applications_count_check
    check (applications_count >= 0),
  constraint job_daily_metrics_apply_clicks_count_check
    check (apply_clicks_count >= 0)
);

create index if not exists job_daily_metrics_metric_date_idx
  on public.job_daily_metrics (metric_date desc);

create index if not exists job_daily_metrics_job_date_idx
  on public.job_daily_metrics (job_id, metric_date desc);

create or replace function public.set_job_daily_metrics_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_job_daily_metrics_updated_at_before_write
  on public.job_daily_metrics;

create trigger set_job_daily_metrics_updated_at_before_write
  before insert or update on public.job_daily_metrics
  for each row
  execute function public.set_job_daily_metrics_updated_at();

alter table public.job_daily_metrics enable row level security;

revoke all on public.job_daily_metrics from anon;
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
      where jobs.id = job_daily_metrics.job_id
        and jobs.created_by = auth.uid()
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

comment on column public.jobs.last_viewed_at is
  'Most recent counted public view timestamp for recruiter analytics.';

comment on table public.job_daily_metrics is
  'Daily per-job analytics rollup. Recruiters can read metrics for their own jobs; service-role workflows write metrics.';

comment on function public.track_public_job_view(text) is
  'Service-role only RPC that counts a view for a currently public published job.';

comment on function public.record_job_application_metric(uuid) is
  'Service-role only future integration point for the Applications module.';

commit;

select
  'recruiter_analytics_verification' as verification,
  count(*) as jobs_count,
  count(*) filter (where views_count is null or views_count < 0) as invalid_view_counts,
  count(*) filter (where applications_count is null or applications_count < 0) as invalid_application_counts
from public.jobs;
