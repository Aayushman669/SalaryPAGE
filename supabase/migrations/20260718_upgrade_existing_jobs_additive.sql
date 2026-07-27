-- Safe additive jobs upgrade.
-- This script intentionally does NOT drop, truncate, rename, or recreate public.jobs.
-- Run the preflight result sets first and review them before running the transactional
-- migration block in a hosted Supabase SQL Editor.

select
  'preflight_columns' as audit,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'jobs'
order by ordinal_position;

select
  'preflight_constraints' as audit,
  conname,
  contype,
  pg_get_constraintdef(pg_constraint.oid) as definition
from pg_constraint
where conrelid = 'public.jobs'::regclass
order by conname;

select
  'preflight_indexes' as audit,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'jobs'
order by indexname;

select
  'preflight_triggers' as audit,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'jobs'
order by trigger_name;

select
  'preflight_policies' as audit,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'jobs'
order by policyname;

select
  'preflight_status_counts' as audit,
  status,
  count(*) as rows
from public.jobs
group by status
order by status;

select
  'preflight_unmapped_status_values' as audit,
  status,
  count(*) as rows
from public.jobs
where status is not null
  and lower(trim(status)) not in (
    'active',
    'approved',
    'archived',
    'closed',
    'draft',
    'inactive',
    'live',
    'open',
    'pending',
    'published',
    'rejected',
    'review',
    'submitted'
  )
group by status
order by status;

do $$
declare
  duplicate_slugs text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'slug'
  ) then
    execute $sql$
      select string_agg(format('%s (%s rows)', slug, rows), ', ')
      from (
        select slug, count(*) as rows
        from public.jobs
        where slug is not null
          and trim(slug) <> ''
        group by slug
        having count(*) > 1
      ) slug_counts
    $sql$
    into duplicate_slugs;

    raise notice 'preflight_slug_duplicates: %',
      coalesce(duplicate_slugs, 'none');
  else
    raise notice 'preflight_slug_duplicates: skipped because public.jobs.slug does not exist yet.';
  end if;
end $$;

select
  'preflight_legacy_column_presence' as audit,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'company'
  ) as has_legacy_company,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'salary'
  ) as has_legacy_salary,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'type'
  ) as has_legacy_type,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'created_by'
  ) as has_created_by,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'user_id'
  ) as has_user_id,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'recruiter_id'
  ) as has_recruiter_id,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'owner_id'
  ) as has_owner_id;

begin;

do $$
begin
  if to_regclass('public.jobs') is null then
    raise exception 'public.jobs does not exist. This additive migration requires the existing table.';
  end if;
end $$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

set local search_path = public, extensions, pg_catalog, pg_temp;

create or replace function public.slugify_job_text(value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select trim(
    both '-' from regexp_replace(
      regexp_replace(lower(coalesce(value, 'job')), '[^a-z0-9]+', '-', 'g'),
      '-+',
      '-',
      'g'
    )
  );
$$;

create or replace function public.generate_job_slug(
  job_title text,
  job_location text default null
)
returns text
language plpgsql
volatile
set search_path = public, extensions, pg_temp
as $$
declare
  base_slug text;
  candidate_slug text;
begin
  base_slug := public.slugify_job_text(
    concat_ws('-', job_title, nullif(job_location, ''))
  );

  if base_slug = '' then
    base_slug := 'job';
  end if;

  candidate_slug := left(base_slug, 148)
    || '-'
    || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6);

  return candidate_slug;
end;
$$;

alter table public.jobs
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists slug text,
  add column if not exists company_name text,
  add column if not exists location text,
  add column if not exists employment_type text,
  add column if not exists workplace_type text,
  add column if not exists salary_min numeric(12, 2),
  add column if not exists salary_max numeric(12, 2),
  add column if not exists salary_currency char(3),
  add column if not exists salary_visible boolean,
  add column if not exists experience_level text,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists requirements text,
  add column if not exists benefits text,
  add column if not exists application_url text,
  add column if not exists application_email text,
  add column if not exists status text,
  add column if not exists legacy_status text,
  add column if not exists featured boolean,
  add column if not exists expires_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid,
  add column if not exists rejection_reason text,
  add column if not exists views_count bigint,
  add column if not exists applications_count bigint;

alter table public.jobs
  alter column created_at set default now(),
  alter column updated_at set default now(),
  alter column salary_currency set default 'USD',
  alter column salary_visible set default true,
  alter column requirements set default '',
  alter column benefits set default '',
  alter column status set default 'draft',
  alter column featured set default false,
  alter column views_count set default 0,
  alter column applications_count set default 0;

update public.jobs
set
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now()),
  salary_currency = coalesce(nullif(upper(trim(salary_currency)), ''), 'USD'),
  salary_visible = coalesce(salary_visible, true),
  requirements = coalesce(requirements, ''),
  benefits = coalesce(benefits, ''),
  featured = coalesce(featured, false),
  views_count = coalesce(views_count, 0),
  applications_count = coalesce(applications_count, 0);

update public.jobs
set legacy_status = status
where legacy_status is null
  and status is not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'company'
  ) then
    execute $sql$
      update public.jobs
      set company_name = nullif(trim(company::text), '')
      where (company_name is null or trim(company_name) = '')
        and company is not null
        and trim(company::text) <> ''
    $sql$;
  end if;
end $$;

update public.jobs
set
  company_name = coalesce(nullif(trim(company_name), ''), 'Company'),
  location = coalesce(nullif(trim(location), ''), 'Not specified'),
  category = coalesce(nullif(trim(category), ''), 'General');

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'type'
  ) then
    execute $sql$
      update public.jobs
      set
        employment_type = case
          when employment_type in (
            'full_time',
            'part_time',
            'contract',
            'temporary',
            'internship',
            'freelance'
          ) then employment_type
          when lower(trim(type::text)) in ('full-time', 'full time', 'full_time') then 'full_time'
          when lower(trim(type::text)) in ('part-time', 'part time', 'part_time') then 'part_time'
          when lower(trim(type::text)) = 'contract' then 'contract'
          when lower(trim(type::text)) = 'temporary' then 'temporary'
          when lower(trim(type::text)) = 'internship' then 'internship'
          when lower(trim(type::text)) = 'freelance' then 'freelance'
          else coalesce(employment_type, 'full_time')
        end,
        workplace_type = case
          when workplace_type in ('remote', 'hybrid', 'on_site') then workplace_type
          when lower(trim(type::text)) = 'remote' then 'remote'
          when lower(trim(type::text)) = 'hybrid' then 'hybrid'
          when lower(trim(type::text)) in ('on-site', 'on site', 'on_site') then 'on_site'
          else coalesce(workplace_type, 'remote')
        end
    $sql$;
  end if;
end $$;

update public.jobs
set
  employment_type = coalesce(nullif(trim(employment_type), ''), 'full_time'),
  workplace_type = coalesce(nullif(trim(workplace_type), ''), 'remote');

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'salary'
  ) then
    execute $sql$
      update public.jobs
      set description = trim(
        concat(
          coalesce(nullif(trim(description), ''), ''),
          case when description is null or trim(description) = '' then '' else E'\n\n' end,
          'Legacy summary: ',
          coalesce(nullif(trim(title), ''), 'Untitled role'),
          ' at ',
          coalesce(nullif(trim(company_name), ''), 'Company'),
          '. Salary: ',
          coalesce(nullif(trim(salary::text), ''), 'Not specified'),
          '. Please review and expand this job description before future publishing updates.'
        )
      )
      where description is null
        or char_length(trim(description)) < 80
    $sql$;
  else
    update public.jobs
    set description = trim(
      concat(
        coalesce(nullif(trim(description), ''), ''),
        case when description is null or trim(description) = '' then '' else E'\n\n' end,
        'Legacy summary: ',
        coalesce(nullif(trim(title), ''), 'Untitled role'),
        ' at ',
        coalesce(nullif(trim(company_name), ''), 'Company'),
        '. Please review and expand this job description before future publishing updates.'
      )
    )
    where description is null
      or char_length(trim(description)) < 80;
  end if;
end $$;

do $$
declare
  ownership_column text;
begin
  foreach ownership_column in array array['created_by', 'recruiter_id', 'owner_id', 'user_id']
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'jobs'
        and column_name = ownership_column
        and udt_name = 'uuid'
    ) then
      execute format(
        $sql$
          update public.jobs
          set created_by = %1$I
          where created_by is null
            and %1$I is not null
            and exists (
              select 1
              from auth.users
              where users.id = %1$I
            )
        $sql$,
        ownership_column
      );

      raise notice 'Attempted created_by backfill from %. Only values matching auth.users(id) were copied.', ownership_column;
    end if;
  end loop;
end $$;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and conname <> 'jobs_status_check'
  loop
    raise notice 'Dropping legacy status check constraint % before installing production status check.', constraint_record.conname;
    execute format('alter table public.jobs drop constraint %I', constraint_record.conname);
  end loop;
end $$;

update public.jobs
set status = lower(trim(status))
where status is not null;

update public.jobs
set status = case
  when status is null or status = '' then 'draft'
  when status in ('draft') then 'draft'
  when status in ('pending', 'submitted', 'review') then 'pending'
  when status in ('approved', 'published', 'live', 'open', 'active') then 'published'
  when status in ('closed', 'inactive') then 'closed'
  when status in ('archived', 'rejected') then 'archived'
  else status
end;

do $$
declare
  unmapped_statuses text;
begin
  select string_agg(format('%s (%s rows)', status, rows), ', ')
  into unmapped_statuses
  from (
    select status, count(*) as rows
    from public.jobs
    where status not in ('draft', 'pending', 'published', 'closed', 'archived')
    group by status
  ) status_counts;

  if unmapped_statuses is not null then
    raise exception
      'Unmapped public.jobs.status values remain after safe mapping: %. Add an explicit mapping before rerunning.',
      unmapped_statuses;
  end if;
end $$;

update public.jobs
set
  published_at = coalesce(published_at, updated_at, created_at, now()),
  approved_at = coalesce(approved_at, updated_at, created_at, now())
where status = 'published';

do $$
declare
  job_row record;
  base_slug text;
  next_slug text;
  attempt integer;
begin
  for job_row in
    select ctid as row_ctid, id::text as id_text, title, location
    from public.jobs
    where slug is null or trim(slug) = ''
  loop
    base_slug := public.slugify_job_text(
      concat_ws('-', job_row.title, job_row.location, job_row.id_text)
    );

    if base_slug = '' then
      base_slug := 'job-' || public.slugify_job_text(job_row.id_text);
    end if;

    attempt := 0;

    loop
      next_slug := left(base_slug, 148)
        || '-'
        || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6);

      exit when not exists (
        select 1
        from public.jobs
        where slug = next_slug
      );

      attempt := attempt + 1;

      if attempt >= 20 then
        raise exception 'Could not generate a unique slug for job id %', job_row.id_text;
      end if;
    end loop;

    update public.jobs
    set slug = next_slug
    where ctid = job_row.row_ctid;
  end loop;
end $$;

do $$
declare
  duplicate_slugs text;
begin
  select string_agg(format('%s (%s rows)', slug, rows), ', ')
  into duplicate_slugs
  from (
    select slug, count(*) as rows
    from public.jobs
    where slug is not null
      and trim(slug) <> ''
    group by slug
    having count(*) > 1
  ) slug_counts;

  if duplicate_slugs is not null then
    raise exception
      'Duplicate public.jobs.slug values exist: %. Existing non-empty slugs were not overwritten. Resolve duplicates manually before creating the unique slug index.',
      duplicate_slugs;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and conname = 'jobs_created_by_fkey'
  ) then
    alter table public.jobs
      add constraint jobs_created_by_fkey
      foreign key (created_by)
      references auth.users(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.jobs'::regclass
      and conname = 'jobs_approved_by_fkey'
  ) then
    alter table public.jobs
      add constraint jobs_approved_by_fkey
      foreign key (approved_by)
      references auth.users(id)
      on delete set null
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_title_length_check') then
    alter table public.jobs add constraint jobs_title_length_check check (title is not null and char_length(trim(title)) between 4 and 140) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_slug_length_check') then
    alter table public.jobs add constraint jobs_slug_length_check check (slug is not null and char_length(trim(slug)) between 8 and 180) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_company_name_length_check') then
    alter table public.jobs add constraint jobs_company_name_length_check check (company_name is not null and char_length(trim(company_name)) between 2 and 140) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_location_length_check') then
    alter table public.jobs add constraint jobs_location_length_check check (location is not null and char_length(trim(location)) between 2 and 140) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_employment_type_check') then
    alter table public.jobs add constraint jobs_employment_type_check check (employment_type in ('full_time', 'part_time', 'contract', 'temporary', 'internship', 'freelance')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_workplace_type_check') then
    alter table public.jobs add constraint jobs_workplace_type_check check (workplace_type in ('remote', 'hybrid', 'on_site')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_salary_min_check') then
    alter table public.jobs add constraint jobs_salary_min_check check (salary_min is null or salary_min >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_salary_max_check') then
    alter table public.jobs add constraint jobs_salary_max_check check (salary_max is null or salary_max >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_salary_range_check') then
    alter table public.jobs add constraint jobs_salary_range_check check (salary_min is null or salary_max is null or salary_max >= salary_min) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_salary_currency_check') then
    alter table public.jobs add constraint jobs_salary_currency_check check (salary_currency ~ '^[A-Z]{3}$') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_experience_level_check') then
    alter table public.jobs add constraint jobs_experience_level_check check (experience_level is null or experience_level in ('internship', 'entry', 'mid', 'senior', 'lead', 'executive')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_category_length_check') then
    alter table public.jobs add constraint jobs_category_length_check check (category is not null and char_length(trim(category)) between 2 and 120) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_description_length_check') then
    alter table public.jobs add constraint jobs_description_length_check check (description is not null and char_length(trim(description)) >= 80) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_status_check') then
    alter table public.jobs add constraint jobs_status_check check (status in ('draft', 'pending', 'published', 'closed', 'archived')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_application_url_check') then
    alter table public.jobs add constraint jobs_application_url_check check (application_url is null or application_url ~* '^https?://.+') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_application_email_check') then
    alter table public.jobs add constraint jobs_application_email_check check (application_email is null or application_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_application_method_check') then
    alter table public.jobs add constraint jobs_application_method_check check (status = 'draft' or application_url is not null or application_email is not null) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_expiry_check') then
    alter table public.jobs add constraint jobs_expiry_check check (expires_at is null or expires_at > created_at) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_views_count_check') then
    alter table public.jobs add constraint jobs_views_count_check check (views_count >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_applications_count_check') then
    alter table public.jobs add constraint jobs_applications_count_check check (applications_count >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.jobs'::regclass and conname = 'jobs_created_by_required_check') then
    alter table public.jobs add constraint jobs_created_by_required_check check (created_by is not null) not valid;
  end if;
end $$;

create unique index if not exists jobs_slug_key
  on public.jobs (slug);

create index if not exists jobs_public_feed_idx
  on public.jobs (featured desc, published_at desc, id desc)
  where status = 'published';

create index if not exists jobs_owner_status_updated_idx
  on public.jobs (created_by, status, updated_at desc);

create index if not exists jobs_status_updated_idx
  on public.jobs (status, updated_at desc);

create index if not exists jobs_category_published_idx
  on public.jobs (category, published_at desc)
  where status = 'published';

create index if not exists jobs_location_published_idx
  on public.jobs (location, published_at desc)
  where status = 'published';

create index if not exists jobs_employment_workplace_idx
  on public.jobs (employment_type, workplace_type, published_at desc)
  where status = 'published';

create index if not exists jobs_expires_at_idx
  on public.jobs (expires_at)
  where status = 'published' and expires_at is not null;

alter table public.jobs
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(company_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(location, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'D')
  ) stored;

create index if not exists jobs_search_vector_idx
  on public.jobs using gin (search_vector);

create or replace function public.set_job_slug()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  next_slug text;
  attempt integer := 0;
begin
  if new.slug is not null and trim(new.slug) <> '' then
    new.slug := public.slugify_job_text(new.slug);
    return new;
  end if;

  loop
    next_slug := public.generate_job_slug(new.title, new.location);

    exit when not exists (
      select 1
      from public.jobs
      where slug = next_slug
        and id is distinct from new.id
    );

    attempt := attempt + 1;

    if attempt >= 20 then
      next_slug := public.slugify_job_text(
        concat_ws('-', new.title, new.location, gen_random_uuid()::text)
      );
      exit;
    end if;
  end loop;

  new.slug := next_slug;
  return new;
end;
$$;

create or replace function public.set_job_system_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  if new.status = 'published' and new.approved_at is null then
    new.approved_at := now();
  end if;

  if new.status <> 'published' and new.featured then
    new.featured := false;
  end if;

  return new;
end;
$$;

drop trigger if exists set_job_slug_before_write on public.jobs;
create trigger set_job_slug_before_write
  before insert or update of slug, title, location on public.jobs
  for each row
  execute function public.set_job_slug();

drop trigger if exists set_job_system_fields_before_write on public.jobs;
create trigger set_job_system_fields_before_write
  before insert or update on public.jobs
  for each row
  execute function public.set_job_system_fields();

grant select on public.jobs to anon;
grant select, insert, update, delete on public.jobs to authenticated;

alter table public.jobs enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'jobs'
  loop
    raise notice 'Replacing existing public.jobs RLS policy: %', policy_record.policyname;
    execute format('drop policy if exists %I on public.jobs', policy_record.policyname);
  end loop;
end $$;

create policy "Published jobs are readable by everyone"
  on public.jobs
  for select
  to anon, authenticated
  using (
    status = 'published'
    and published_at is not null
    and (expires_at is null or expires_at > now())
  );

create policy "Recruiters can read their own jobs"
  on public.jobs
  for select
  to authenticated
  using (created_by = auth.uid());

create policy "Recruiters can create their own jobs"
  on public.jobs
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and status in ('draft', 'pending')
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    )
  );

create policy "Recruiters can update their own jobs"
  on public.jobs
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and status in ('draft', 'pending', 'closed', 'archived')
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    )
  );

create policy "Recruiters can delete their own drafts"
  on public.jobs
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    and status = 'draft'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    )
  );

do $$
begin
  if not exists (select 1 from public.jobs where title is null or char_length(trim(title)) not between 4 and 140) then
    alter table public.jobs validate constraint jobs_title_length_check;
    alter table public.jobs alter column title set not null;
  else
    raise notice 'Skipped title NOT NULL/constraint validation because some existing rows still need review.';
  end if;

  if not exists (select 1 from public.jobs where created_by is null) then
    alter table public.jobs validate constraint jobs_created_by_required_check;
    alter table public.jobs validate constraint jobs_created_by_fkey;
    alter table public.jobs alter column created_by set not null;
  else
    raise notice 'Skipped created_by NOT NULL because some existing jobs do not have certain recruiter ownership.';
  end if;

  if not exists (select 1 from public.jobs where company_name is null or char_length(trim(company_name)) not between 2 and 140) then
    alter table public.jobs validate constraint jobs_company_name_length_check;
    alter table public.jobs alter column company_name set not null;
  end if;

  if not exists (select 1 from public.jobs where location is null or char_length(trim(location)) not between 2 and 140) then
    alter table public.jobs validate constraint jobs_location_length_check;
    alter table public.jobs alter column location set not null;
  end if;

  if not exists (select 1 from public.jobs where employment_type not in ('full_time', 'part_time', 'contract', 'temporary', 'internship', 'freelance')) then
    alter table public.jobs validate constraint jobs_employment_type_check;
    alter table public.jobs alter column employment_type set not null;
  end if;

  if not exists (select 1 from public.jobs where workplace_type not in ('remote', 'hybrid', 'on_site')) then
    alter table public.jobs validate constraint jobs_workplace_type_check;
    alter table public.jobs alter column workplace_type set not null;
  end if;

  if not exists (select 1 from public.jobs where category is null or char_length(trim(category)) not between 2 and 120) then
    alter table public.jobs validate constraint jobs_category_length_check;
    alter table public.jobs alter column category set not null;
  end if;

  if not exists (select 1 from public.jobs where description is null or char_length(trim(description)) < 80) then
    alter table public.jobs validate constraint jobs_description_length_check;
    alter table public.jobs alter column description set not null;
  end if;

  if not exists (select 1 from public.jobs where status not in ('draft', 'pending', 'published', 'closed', 'archived')) then
    alter table public.jobs validate constraint jobs_status_check;
    alter table public.jobs alter column status set not null;
  end if;

  if not exists (select 1 from public.jobs where slug is null or char_length(trim(slug)) not between 8 and 180) then
    alter table public.jobs validate constraint jobs_slug_length_check;
    alter table public.jobs alter column slug set not null;
  end if;

  if not exists (select 1 from public.jobs where salary_min is not null and salary_min < 0) then
    alter table public.jobs validate constraint jobs_salary_min_check;
  end if;

  if not exists (select 1 from public.jobs where salary_max is not null and salary_max < 0) then
    alter table public.jobs validate constraint jobs_salary_max_check;
  end if;

  if not exists (select 1 from public.jobs where salary_min is not null and salary_max is not null and salary_max < salary_min) then
    alter table public.jobs validate constraint jobs_salary_range_check;
  end if;

  if not exists (select 1 from public.jobs where salary_currency is null or salary_currency !~ '^[A-Z]{3}$') then
    alter table public.jobs validate constraint jobs_salary_currency_check;
    alter table public.jobs alter column salary_currency set not null;
  end if;

  if not exists (select 1 from public.jobs where salary_visible is null) then
    alter table public.jobs alter column salary_visible set not null;
  end if;

  if not exists (select 1 from public.jobs where featured is null) then
    alter table public.jobs alter column featured set not null;
  end if;

  if not exists (select 1 from public.jobs where views_count is null or views_count < 0) then
    alter table public.jobs validate constraint jobs_views_count_check;
    alter table public.jobs alter column views_count set not null;
  end if;

  if not exists (select 1 from public.jobs where applications_count is null or applications_count < 0) then
    alter table public.jobs validate constraint jobs_applications_count_check;
    alter table public.jobs alter column applications_count set not null;
  end if;

  if not exists (select 1 from public.jobs where approved_by is not null and not exists (select 1 from auth.users where users.id = jobs.approved_by)) then
    alter table public.jobs validate constraint jobs_approved_by_fkey;
  end if;

  if not exists (select 1 from public.jobs where experience_level is not null and experience_level not in ('internship', 'entry', 'mid', 'senior', 'lead', 'executive')) then
    alter table public.jobs validate constraint jobs_experience_level_check;
  end if;

  if not exists (select 1 from public.jobs where application_url is not null and application_url !~* '^https?://.+') then
    alter table public.jobs validate constraint jobs_application_url_check;
  end if;

  if not exists (select 1 from public.jobs where application_email is not null and application_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$') then
    alter table public.jobs validate constraint jobs_application_email_check;
  end if;

  if not exists (select 1 from public.jobs where expires_at is not null and expires_at <= created_at) then
    alter table public.jobs validate constraint jobs_expiry_check;
  end if;

  if not exists (select 1 from public.jobs where status <> 'draft' and application_url is null and application_email is null) then
    alter table public.jobs validate constraint jobs_application_method_check;
  else
    raise notice 'Skipped application method validation because some existing non-draft rows have no application_url or application_email.';
  end if;
end $$;

comment on table public.jobs is
  'Production jobs table upgraded additively from the legacy schema without dropping existing rows.';

comment on column public.jobs.legacy_status is
  'Original status value captured before production status mapping.';

comment on column public.jobs.created_by is
  'Authenticated recruiter who owns this job. Null may remain only for legacy rows where ownership could not be mapped safely.';

comment on column public.jobs.slug is
  'Unique URL slug. Existing non-empty slugs are preserved; missing slugs are generated.';

comment on column public.jobs.status is
  'Allowed lifecycle values: draft, pending, published, closed, archived.';

commit;

select
  'post_status_counts' as verification,
  status,
  count(*) as rows
from public.jobs
group by status
order by status;

select
  'post_unmapped_status_values' as verification,
  status,
  count(*) as rows
from public.jobs
where status not in ('draft', 'pending', 'published', 'closed', 'archived')
group by status
order by status;

select
  'post_required_field_gaps' as verification,
  count(*) filter (where created_by is null) as missing_created_by,
  count(*) filter (where slug is null or trim(slug) = '') as missing_slug,
  count(*) filter (where company_name is null or trim(company_name) = '') as missing_company_name,
  count(*) filter (where location is null or trim(location) = '') as missing_location,
  count(*) filter (where description is null or char_length(trim(description)) < 80) as weak_description,
  count(*) filter (where status <> 'draft' and application_url is null and application_email is null) as non_draft_missing_application_method
from public.jobs;

select
  'post_duplicate_slugs' as verification,
  slug,
  count(*) as rows
from public.jobs
group by slug
having count(*) > 1
order by rows desc, slug;

select
  'post_constraints' as verification,
  conname,
  contype,
  convalidated,
  pg_get_constraintdef(pg_constraint.oid) as definition
from pg_constraint
where conrelid = 'public.jobs'::regclass
order by conname;

select
  'post_policies' as verification,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'jobs'
order by policyname;

-- Rollback plan:
-- 1. Do not drop added columns if users may have written new job data after migration.
-- 2. To roll back RLS only, review the preflight_policies output and recreate the previous policies.
-- 3. To roll back status mapping, use legacy_status:
--      update public.jobs set status = legacy_status where legacy_status is not null;
-- 4. To remove new database objects after confirming no new data depends on them:
--      drop trigger if exists set_job_slug_before_write on public.jobs;
--      drop trigger if exists set_job_system_fields_before_write on public.jobs;
--      drop function if exists public.set_job_slug();
--      drop function if exists public.set_job_system_fields();
--      drop function if exists public.generate_job_slug(text, text);
--      drop function if exists public.slugify_job_text(text);
--      drop index if exists public.jobs_search_vector_idx;
--      drop index if exists public.jobs_expires_at_idx;
--      drop index if exists public.jobs_employment_workplace_idx;
--      drop index if exists public.jobs_location_published_idx;
--      drop index if exists public.jobs_category_published_idx;
--      drop index if exists public.jobs_status_updated_idx;
--      drop index if exists public.jobs_owner_status_updated_idx;
--      drop index if exists public.jobs_public_feed_idx;
--      drop index if exists public.jobs_slug_key;
