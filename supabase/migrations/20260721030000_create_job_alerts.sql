begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

create table if not exists public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  alert_name text not null,
  keywords text[] not null default '{}'::text[],
  location text,
  employment_type text,
  work_model text,
  salary_min numeric(12, 2),
  experience_level text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_alerts
  add column if not exists candidate_id uuid,
  add column if not exists alert_name text,
  add column if not exists keywords text[] default '{}'::text[],
  add column if not exists location text,
  add column if not exists employment_type text,
  add column if not exists work_model text,
  add column if not exists salary_min numeric(12, 2),
  add column if not exists experience_level text,
  add column if not exists enabled boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.job_alerts
set
  keywords = coalesce(keywords, '{}'::text[]),
  enabled = coalesce(enabled, true),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_alerts'::regclass
      and conname = 'job_alerts_candidate_id_fkey'
  ) then
    alter table public.job_alerts
      add constraint job_alerts_candidate_id_fkey
      foreign key (candidate_id)
      references public.profiles(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_alerts'::regclass
      and conname = 'job_alerts_alert_name_check'
  ) then
    alter table public.job_alerts
      add constraint job_alerts_alert_name_check
      check (char_length(trim(alert_name)) between 2 and 120)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_alerts'::regclass
      and conname = 'job_alerts_keywords_check'
  ) then
    alter table public.job_alerts
      add constraint job_alerts_keywords_check
      check (cardinality(keywords) <= 20)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_alerts'::regclass
      and conname = 'job_alerts_employment_type_check'
  ) then
    alter table public.job_alerts
      add constraint job_alerts_employment_type_check
      check (
        employment_type is null
        or employment_type in (
          'full_time', 'part_time', 'contract', 'temporary',
          'internship', 'freelance'
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_alerts'::regclass
      and conname = 'job_alerts_work_model_check'
  ) then
    alter table public.job_alerts
      add constraint job_alerts_work_model_check
      check (work_model is null or work_model in ('remote', 'hybrid', 'on_site'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_alerts'::regclass
      and conname = 'job_alerts_experience_level_check'
  ) then
    alter table public.job_alerts
      add constraint job_alerts_experience_level_check
      check (
        experience_level is null
        or experience_level in (
          'internship', 'entry', 'mid', 'senior', 'lead', 'executive'
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.job_alerts'::regclass
      and conname = 'job_alerts_salary_min_check'
  ) then
    alter table public.job_alerts
      add constraint job_alerts_salary_min_check
      check (salary_min is null or salary_min >= 0)
      not valid;
  end if;
end;
$$;

create index if not exists job_alerts_candidate_recent_idx
  on public.job_alerts (candidate_id, created_at desc, id desc);

create index if not exists job_alerts_candidate_enabled_idx
  on public.job_alerts (candidate_id, enabled, updated_at desc, id desc);

create index if not exists job_alerts_enabled_match_idx
  on public.job_alerts (enabled, employment_type, work_model, experience_level);

create index if not exists job_alerts_keywords_gin_idx
  on public.job_alerts using gin (keywords);

create or replace function public.set_job_alert_updated_at()
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

drop trigger if exists job_alerts_set_updated_at on public.job_alerts;
create trigger job_alerts_set_updated_at
before update on public.job_alerts
for each row execute function public.set_job_alert_updated_at();

grant select on public.job_alerts to authenticated;
revoke insert, update, delete on public.job_alerts from authenticated;
revoke all on public.job_alerts from anon;

alter table public.job_alerts enable row level security;

drop policy if exists "Candidates can read their own job alerts" on public.job_alerts;
create policy "Candidates can read their own job alerts"
  on public.job_alerts
  for select to authenticated
  using (
    job_alerts.candidate_id = auth.uid()
    and exists (
      select 1
      from public.profiles as candidate_profile
      where candidate_profile.id = auth.uid()
        and candidate_profile.role_mode = 'job_seeker'
        and candidate_profile.moderation_status = 'active'
    )
  );

drop policy if exists "Candidates can create their own job alerts" on public.job_alerts;
create policy "Candidates can create their own job alerts"
  on public.job_alerts
  for insert to authenticated
  with check (
    job_alerts.candidate_id = auth.uid()
    and exists (
      select 1
      from public.profiles as candidate_profile
      where candidate_profile.id = auth.uid()
        and candidate_profile.role_mode = 'job_seeker'
        and candidate_profile.moderation_status = 'active'
    )
  );

drop policy if exists "Candidates can update their own job alerts" on public.job_alerts;
create policy "Candidates can update their own job alerts"
  on public.job_alerts
  for update to authenticated
  using (job_alerts.candidate_id = auth.uid())
  with check (
    job_alerts.candidate_id = auth.uid()
    and exists (
      select 1
      from public.profiles as candidate_profile
      where candidate_profile.id = auth.uid()
        and candidate_profile.role_mode = 'job_seeker'
        and candidate_profile.moderation_status = 'active'
    )
  );

drop policy if exists "Candidates can delete their own job alerts" on public.job_alerts;
create policy "Candidates can delete their own job alerts"
  on public.job_alerts
  for delete to authenticated
  using (job_alerts.candidate_id = auth.uid());

create or replace function public.assert_job_alert_candidate()
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
    from public.profiles as candidate_profile
    where candidate_profile.id = actor_id
      and candidate_profile.role_mode = 'job_seeker'
      and candidate_profile.profile_completed = true
      and candidate_profile.moderation_status = 'active'
  ) then
    raise exception 'job_seeker_required' using errcode = '42501';
  end if;

  return actor_id;
end;
$$;

create or replace function public.get_candidate_job_alerts(
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
    alert_rows.created_at,
    alert_rows.updated_at,
    count(*) over () as total_count,
    count(*) filter (where alert_rows.enabled) over () as enabled_count
  from public.job_alerts as alert_rows
  where alert_rows.candidate_id = public.assert_job_alert_candidate()
  order by alert_rows.updated_at desc, alert_rows.id desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.upsert_candidate_job_alert(
  p_alert_id uuid default null,
  p_alert_name text default '',
  p_keywords text[] default '{}'::text[],
  p_location text default null,
  p_employment_type text default null,
  p_work_model text default null,
  p_salary_min numeric default null,
  p_experience_level text default null,
  p_enabled boolean default true
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
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  actor_id uuid := public.assert_job_alert_candidate();
  normalized_name text := nullif(trim(coalesce(p_alert_name, '')), '');
  normalized_keywords text[];
  normalized_location text := nullif(trim(coalesce(p_location, '')), '');
  saved_id uuid;
begin
  if normalized_name is null or char_length(normalized_name) < 2 or char_length(normalized_name) > 120 then
    raise exception 'alert_name_invalid' using errcode = '22023';
  end if;

  if normalized_location is not null and char_length(normalized_location) > 160 then
    raise exception 'location_invalid' using errcode = '22023';
  end if;

  if p_employment_type is not null and p_employment_type not in (
    'full_time', 'part_time', 'contract', 'temporary', 'internship', 'freelance'
  ) then
    raise exception 'employment_type_invalid' using errcode = '22023';
  end if;

  if p_work_model is not null and p_work_model not in ('remote', 'hybrid', 'on_site') then
    raise exception 'work_model_invalid' using errcode = '22023';
  end if;

  if p_experience_level is not null and p_experience_level not in (
    'internship', 'entry', 'mid', 'senior', 'lead', 'executive'
  ) then
    raise exception 'experience_level_invalid' using errcode = '22023';
  end if;

  if p_salary_min is not null and p_salary_min < 0 then
    raise exception 'salary_invalid' using errcode = '22023';
  end if;

  if coalesce(cardinality(p_keywords), 0) > 20 then
    raise exception 'keywords_invalid' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_keywords, '{}'::text[])) as keyword_value
    where char_length(trim(keyword_value)) > 80
  ) then
    raise exception 'keywords_invalid' using errcode = '22023';
  end if;

  select coalesce(array_agg(keyword_value order by keyword_value), '{}'::text[])
  into normalized_keywords
  from (
    select distinct lower(trim(keyword_value)) as keyword_value
    from unnest(coalesce(p_keywords, '{}'::text[])) as keyword_value
    where trim(keyword_value) <> ''
  ) as normalized_keyword_rows;

  if p_alert_id is null then
    insert into public.job_alerts (
      candidate_id,
      alert_name,
      keywords,
      location,
      employment_type,
      work_model,
      salary_min,
      experience_level,
      enabled
    )
    values (
      actor_id,
      normalized_name,
      coalesce(normalized_keywords, '{}'::text[]),
      normalized_location,
      p_employment_type,
      p_work_model,
      p_salary_min,
      p_experience_level,
      coalesce(p_enabled, true)
    )
    returning job_alerts.id into saved_id;
  else
    update public.job_alerts
    set
      alert_name = normalized_name,
      keywords = coalesce(normalized_keywords, '{}'::text[]),
      location = normalized_location,
      employment_type = p_employment_type,
      work_model = p_work_model,
      salary_min = p_salary_min,
      experience_level = p_experience_level,
      enabled = coalesce(p_enabled, true),
      updated_at = now()
    where job_alerts.id = p_alert_id
      and job_alerts.candidate_id = actor_id
    returning job_alerts.id into saved_id;

    if saved_id is null then
      raise exception 'alert_not_found' using errcode = 'P0001';
    end if;
  end if;

  return query
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
      alert_rows.created_at,
      alert_rows.updated_at
    from public.job_alerts as alert_rows
    where alert_rows.id = saved_id
      and alert_rows.candidate_id = actor_id;
end;
$$;

create or replace function public.set_candidate_job_alert_enabled(
  p_alert_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  actor_id uuid := public.assert_job_alert_candidate();
  changed boolean;
begin
  update public.job_alerts
  set enabled = coalesce(p_enabled, false), updated_at = now()
  where job_alerts.id = p_alert_id
    and job_alerts.candidate_id = actor_id
  returning true into changed;

  if changed is null then
    raise exception 'alert_not_found' using errcode = 'P0001';
  end if;

  return changed;
end;
$$;

create or replace function public.delete_candidate_job_alert(p_alert_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  actor_id uuid := public.assert_job_alert_candidate();
  deleted boolean;
  deleted_count integer;
begin
  delete from public.job_alerts
  where job_alerts.id = p_alert_id
    and job_alerts.candidate_id = actor_id;

  get diagnostics deleted_count = row_count;
  deleted := deleted_count > 0;
  return deleted;
end;
$$;

-- Delivery is intentionally out of scope. This server-only matcher provides a
-- narrow, reusable contract for the future Day 10 notification worker.
create or replace function public.get_matching_job_alerts(p_job_id uuid)
returns table (
  alert_id uuid,
  candidate_id uuid
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  with public_job as (
    select
      jobs.id,
      jobs.title,
      jobs.company_name,
      jobs.category,
      jobs.description,
      jobs.location,
      jobs.employment_type,
      jobs.workplace_type,
      jobs.experience_level,
      jobs.salary_min,
      jobs.salary_max
    from public.jobs
    where jobs.id = p_job_id
      and jobs.status = 'published'
      and jobs.moderation_status = 'active'
      and jobs.published_at is not null
      and (jobs.publish_at is null or jobs.publish_at <= now())
      and (jobs.expires_at is null or jobs.expires_at > now())
      and (
        jobs.company_id is null
        or exists (
          select 1
          from public.companies
          where companies.id = jobs.company_id
            and companies.moderation_status = 'active'
        )
      )
  )
  select
    alert_rows.id as alert_id,
    alert_rows.candidate_id
  from public.job_alerts as alert_rows
  inner join public_job
    on true
  where alert_rows.enabled
    and (
      cardinality(alert_rows.keywords) = 0
      or exists (
        select 1
        from unnest(alert_rows.keywords) as keyword_value
        where concat_ws(
          ' ',
          public_job.title,
          public_job.company_name,
          public_job.category,
          public_job.description
        ) ilike '%' || keyword_value || '%'
      )
    )
    and (
      alert_rows.location is null
      or public_job.location ilike '%' || alert_rows.location || '%'
    )
    and (
      alert_rows.employment_type is null
      or alert_rows.employment_type = public_job.employment_type
    )
    and (
      alert_rows.work_model is null
      or alert_rows.work_model = public_job.workplace_type
    )
    and (
      alert_rows.experience_level is null
      or alert_rows.experience_level = public_job.experience_level
    )
    and (
      alert_rows.salary_min is null
      or coalesce(public_job.salary_max, public_job.salary_min) >= alert_rows.salary_min
    );
$$;

revoke all on function public.set_job_alert_updated_at() from public, anon, authenticated;
revoke all on function public.assert_job_alert_candidate() from public, anon, authenticated;
revoke all on function public.get_candidate_job_alerts(integer, integer) from public, anon, authenticated;
revoke all on function public.upsert_candidate_job_alert(uuid, text, text[], text, text, text, numeric, text, boolean) from public, anon, authenticated;
revoke all on function public.set_candidate_job_alert_enabled(uuid, boolean) from public, anon, authenticated;
revoke all on function public.delete_candidate_job_alert(uuid) from public, anon, authenticated;
revoke all on function public.get_matching_job_alerts(uuid) from public, anon, authenticated;

grant execute on function public.get_candidate_job_alerts(integer, integer) to authenticated;
grant execute on function public.upsert_candidate_job_alert(uuid, text, text[], text, text, text, numeric, text, boolean) to authenticated;
grant execute on function public.set_candidate_job_alert_enabled(uuid, boolean) to authenticated;
grant execute on function public.delete_candidate_job_alert(uuid) to authenticated;
grant execute on function public.get_matching_job_alerts(uuid) to service_role;

notify pgrst, 'reload schema';

commit;
