begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- Extend the existing notification preference row instead of creating a second
-- notification settings table.
alter table public.email_preferences
  add column if not exists application_updates_email boolean not null default true,
  add column if not exists application_updates_in_app boolean not null default true,
  add column if not exists saved_job_reminders_email boolean not null default true,
  add column if not exists job_alerts_email boolean not null default true,
  add column if not exists job_alerts_in_app boolean not null default true,
  add column if not exists relevant_jobs_email boolean not null default true,
  add column if not exists relevant_jobs_in_app boolean not null default true,
  add column if not exists billing_updates_email boolean not null default true,
  add column if not exists billing_updates_in_app boolean not null default true,
  add column if not exists product_updates_in_app boolean not null default true,
  add column if not exists security_updates_in_app boolean not null default true,
  add column if not exists job_alerts_enabled boolean not null default true,
  add column if not exists job_alert_frequency text not null default 'daily';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.email_preferences'::regclass
      and conname = 'email_preferences_job_alert_frequency_check'
  ) then
    alter table public.email_preferences
      add constraint email_preferences_job_alert_frequency_check
      check (job_alert_frequency in ('instant', 'daily', 'weekly'));
  end if;
end;
$$;

create table if not exists public.candidate_privacy_settings (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.profiles(id) on delete cascade,
  profile_visibility text not null default 'application_only',
  resume_visibility text not null default 'application_only',
  recruiter_discoverable boolean not null default false,
  show_portfolio boolean not null default true,
  show_social_links boolean not null default true,
  show_location boolean not null default true,
  show_experience boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_privacy_profile_visibility_check
    check (profile_visibility in ('private', 'application_only')),
  constraint candidate_privacy_resume_visibility_check
    check (resume_visibility in ('private', 'application_only'))
);

create index if not exists candidate_privacy_settings_candidate_idx
  on public.candidate_privacy_settings (candidate_id);

create or replace function public.set_candidate_privacy_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists candidate_privacy_settings_set_updated_at
  on public.candidate_privacy_settings;
create trigger candidate_privacy_settings_set_updated_at
before update on public.candidate_privacy_settings
for each row execute function public.set_candidate_privacy_updated_at();

alter table public.candidate_privacy_settings enable row level security;
revoke all on public.candidate_privacy_settings from anon;
grant select, insert, update on public.candidate_privacy_settings to authenticated;

drop policy if exists "Candidates can read their privacy settings"
  on public.candidate_privacy_settings;
create policy "Candidates can read their privacy settings"
  on public.candidate_privacy_settings
  for select to authenticated
  using (
    candidate_privacy_settings.candidate_id = auth.uid()
    and exists (
      select 1
      from public.profiles as candidate_profile
      where candidate_profile.id = auth.uid()
        and candidate_profile.role_mode = 'job_seeker'
    )
  );

drop policy if exists "Candidates can create their privacy settings"
  on public.candidate_privacy_settings;
create policy "Candidates can create their privacy settings"
  on public.candidate_privacy_settings
  for insert to authenticated
  with check (
    candidate_privacy_settings.candidate_id = auth.uid()
    and exists (
      select 1
      from public.profiles as candidate_profile
      where candidate_profile.id = auth.uid()
        and candidate_profile.role_mode = 'job_seeker'
    )
  );

drop policy if exists "Candidates can update their privacy settings"
  on public.candidate_privacy_settings;
create policy "Candidates can update their privacy settings"
  on public.candidate_privacy_settings
  for update to authenticated
  using (candidate_privacy_settings.candidate_id = auth.uid())
  with check (
    candidate_privacy_settings.candidate_id = auth.uid()
    and exists (
      select 1
      from public.profiles as candidate_profile
      where candidate_profile.id = auth.uid()
        and candidate_profile.role_mode = 'job_seeker'
    )
  );

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_deletion_requests_status_check
    check (status in ('requested', 'under_review', 'scheduled', 'completed', 'cancelled'))
);

create unique index if not exists account_deletion_requests_one_active_idx
  on public.account_deletion_requests (user_id)
  where status in ('requested', 'under_review', 'scheduled');

create index if not exists account_deletion_requests_requested_at_idx
  on public.account_deletion_requests (requested_at desc);

create or replace function public.set_account_deletion_request_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists account_deletion_requests_set_updated_at
  on public.account_deletion_requests;
create trigger account_deletion_requests_set_updated_at
before update on public.account_deletion_requests
for each row execute function public.set_account_deletion_request_updated_at();

alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon;
grant select, insert on public.account_deletion_requests to authenticated;

drop policy if exists "Candidates can read their deletion requests"
  on public.account_deletion_requests;
create policy "Candidates can read their deletion requests"
  on public.account_deletion_requests
  for select to authenticated
  using (
    account_deletion_requests.user_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'job_seeker'
    )
  );

drop policy if exists "Candidates can create their deletion requests"
  on public.account_deletion_requests;
create policy "Candidates can create their deletion requests"
  on public.account_deletion_requests
  for insert to authenticated
  with check (
    account_deletion_requests.user_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'job_seeker'
    )
  );

alter table public.job_alerts
  add column if not exists frequency text not null default 'daily';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_alerts'::regclass
      and conname = 'job_alerts_frequency_check'
  ) then
    alter table public.job_alerts
      add constraint job_alerts_frequency_check
      check (frequency in ('instant', 'daily', 'weekly'));
  end if;
end;
$$;

create index if not exists job_alerts_candidate_frequency_idx
  on public.job_alerts (candidate_id, frequency, enabled, updated_at desc);

create or replace function public.assert_candidate_settings_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = actor_id
      and profiles.role_mode = 'job_seeker'
      and profiles.moderation_status = 'active'
  ) then
    raise exception 'job_seeker_required' using errcode = '42501';
  end if;

  return actor_id;
end;
$$;

create or replace function public.get_candidate_privacy_settings()
returns table (
  candidate_id uuid,
  profile_visibility text,
  resume_visibility text,
  recruiter_discoverable boolean,
  show_portfolio boolean,
  show_social_links boolean,
  show_location boolean,
  show_experience boolean
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    privacy.candidate_id,
    privacy.profile_visibility,
    privacy.resume_visibility,
    privacy.recruiter_discoverable,
    privacy.show_portfolio,
    privacy.show_social_links,
    privacy.show_location,
    privacy.show_experience
  from public.candidate_privacy_settings as privacy
  where privacy.candidate_id = public.assert_candidate_settings_actor();
$$;

create or replace function public.upsert_candidate_privacy_settings(
  p_profile_visibility text default 'application_only',
  p_resume_visibility text default 'application_only',
  p_recruiter_discoverable boolean default false,
  p_show_portfolio boolean default true,
  p_show_social_links boolean default true,
  p_show_location boolean default true,
  p_show_experience boolean default true
)
returns table (
  candidate_id uuid,
  profile_visibility text,
  resume_visibility text,
  recruiter_discoverable boolean,
  show_portfolio boolean,
  show_social_links boolean,
  show_location boolean,
  show_experience boolean
)
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  actor_id uuid := public.assert_candidate_settings_actor();
begin
  if p_profile_visibility not in ('private', 'application_only')
    or p_resume_visibility not in ('private', 'application_only') then
    raise exception 'privacy_value_invalid' using errcode = '22023';
  end if;

  insert into public.candidate_privacy_settings (
    candidate_id,
    profile_visibility,
    resume_visibility,
    recruiter_discoverable,
    show_portfolio,
    show_social_links,
    show_location,
    show_experience
  ) values (
    actor_id,
    p_profile_visibility,
    p_resume_visibility,
    coalesce(p_recruiter_discoverable, false),
    coalesce(p_show_portfolio, true),
    coalesce(p_show_social_links, true),
    coalesce(p_show_location, true),
    coalesce(p_show_experience, true)
  )
  on conflict (candidate_id) do update set
    profile_visibility = excluded.profile_visibility,
    resume_visibility = excluded.resume_visibility,
    recruiter_discoverable = excluded.recruiter_discoverable,
    show_portfolio = excluded.show_portfolio,
    show_social_links = excluded.show_social_links,
    show_location = excluded.show_location,
    show_experience = excluded.show_experience,
    updated_at = now();

  return query
  select * from public.get_candidate_privacy_settings();
end;
$$;

create or replace function public.set_candidate_job_alert_frequency(
  p_alert_id uuid,
  p_frequency text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  actor_id uuid := public.assert_candidate_settings_actor();
begin
  if p_frequency not in ('instant', 'daily', 'weekly') then
    raise exception 'alert_frequency_invalid' using errcode = '22023';
  end if;

  update public.job_alerts
  set frequency = p_frequency,
      updated_at = now()
  where job_alerts.id = p_alert_id
    and job_alerts.candidate_id = actor_id;

  if not found then
    raise exception 'alert_not_found' using errcode = 'P0001';
  end if;

  return true;
end;
$$;

create or replace function public.get_candidate_job_alerts_with_frequency(
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  id uuid,
  candidate_id uuid,
  alert_name text,
  keywords text[],
  location text,
  employment_type text,
  work_model text,
  salary_min numeric,
  experience_level text,
  enabled boolean,
  frequency text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint,
  enabled_count bigint
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    alert_rows.id,
    alert_rows.candidate_id,
    alert_rows.alert_name,
    alert_rows.keywords,
    alert_rows.location,
    alert_rows.employment_type,
    alert_rows.work_model,
    alert_rows.salary_min,
    alert_rows.experience_level,
    alert_rows.enabled,
    alert_rows.frequency,
    alert_rows.created_at,
    alert_rows.updated_at,
    count(*) over () as total_count,
    count(*) filter (where alert_rows.enabled) over () as enabled_count
  from public.job_alerts as alert_rows
  where alert_rows.candidate_id = public.assert_candidate_settings_actor()
  order by alert_rows.updated_at desc, alert_rows.id desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.request_candidate_account_deletion(
  p_reason text default null
)
returns table (
  id uuid,
  reason text,
  status text,
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  actor_id uuid := public.assert_candidate_settings_actor();
begin
  insert into public.account_deletion_requests (user_id, reason)
  values (actor_id, nullif(trim(coalesce(p_reason, '')), ''))
  returning
    account_deletion_requests.id,
    account_deletion_requests.reason,
    account_deletion_requests.status,
    account_deletion_requests.requested_at
  into id, reason, status, requested_at;

  return next;
exception
  when unique_violation then
    raise exception 'deletion_request_already_exists' using errcode = '23505';
end;
$$;

create or replace function public.get_candidate_account_deletion_request()
returns table (
  id uuid,
  reason text,
  status text,
  requested_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    requests.id,
    requests.reason,
    requests.status,
    requests.requested_at
  from public.account_deletion_requests as requests
  where requests.user_id = public.assert_candidate_settings_actor()
  order by requests.requested_at desc
  limit 1;
$$;

revoke all on function public.assert_candidate_settings_actor() from public, anon, authenticated;
revoke all on function public.get_candidate_privacy_settings() from public, anon, authenticated;
revoke all on function public.upsert_candidate_privacy_settings(text, text, boolean, boolean, boolean, boolean, boolean) from public, anon, authenticated;
revoke all on function public.set_candidate_job_alert_frequency(uuid, text) from public, anon, authenticated;
revoke all on function public.get_candidate_job_alerts_with_frequency(integer, integer) from public, anon, authenticated;
revoke all on function public.request_candidate_account_deletion(text) from public, anon, authenticated;
revoke all on function public.get_candidate_account_deletion_request() from public, anon, authenticated;

grant execute on function public.get_candidate_privacy_settings() to authenticated;
grant execute on function public.upsert_candidate_privacy_settings(text, text, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.set_candidate_job_alert_frequency(uuid, text) to authenticated;
grant execute on function public.get_candidate_job_alerts_with_frequency(integer, integer) to authenticated;
grant execute on function public.request_candidate_account_deletion(text) to authenticated;
grant execute on function public.get_candidate_account_deletion_request() to authenticated;

notify pgrst, 'reload schema';

commit;
