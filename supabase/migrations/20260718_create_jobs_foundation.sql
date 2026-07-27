create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'jobs'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'created_by'
  ) then
    raise exception
      'public.jobs already exists but is missing production foundation columns. Back up or rename the legacy table before applying 20260718_create_jobs_foundation.sql.';
  end if;
end $$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text not null,
  company_name text not null,
  location text not null,
  employment_type text not null,
  workplace_type text not null,
  salary_min numeric(12, 2),
  salary_max numeric(12, 2),
  salary_currency char(3) not null default 'USD',
  salary_visible boolean not null default true,
  experience_level text,
  category text not null,
  description text not null,
  requirements text not null default '',
  benefits text not null default '',
  application_url text,
  application_email text,
  status text not null default 'draft',
  featured boolean not null default false,
  expires_at timestamptz,
  published_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  rejection_reason text,
  views_count bigint not null default 0,
  applications_count bigint not null default 0,
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(company_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(location, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'D')
  ) stored,
  constraint jobs_title_length_check
    check (char_length(trim(title)) between 4 and 140),
  constraint jobs_slug_length_check
    check (char_length(trim(slug)) between 8 and 180),
  constraint jobs_company_name_length_check
    check (char_length(trim(company_name)) between 2 and 140),
  constraint jobs_location_length_check
    check (char_length(trim(location)) between 2 and 140),
  constraint jobs_employment_type_check
    check (
      employment_type in (
        'full_time',
        'part_time',
        'contract',
        'temporary',
        'internship',
        'freelance'
      )
    ),
  constraint jobs_workplace_type_check
    check (workplace_type in ('remote', 'hybrid', 'on_site')),
  constraint jobs_salary_min_check
    check (salary_min is null or salary_min >= 0),
  constraint jobs_salary_max_check
    check (salary_max is null or salary_max >= 0),
  constraint jobs_salary_range_check
    check (
      salary_min is null
      or salary_max is null
      or salary_max >= salary_min
    ),
  constraint jobs_salary_currency_check
    check (salary_currency ~ '^[A-Z]{3}$'),
  constraint jobs_experience_level_check
    check (
      experience_level is null
      or experience_level in (
        'internship',
        'entry',
        'mid',
        'senior',
        'lead',
        'executive'
      )
    ),
  constraint jobs_category_length_check
    check (char_length(trim(category)) between 2 and 120),
  constraint jobs_description_length_check
    check (char_length(trim(description)) >= 80),
  constraint jobs_status_check
    check (status in ('draft', 'pending', 'published', 'closed', 'archived')),
  constraint jobs_application_url_check
    check (
      application_url is null
      or application_url ~* '^https?://.+'
    ),
  constraint jobs_application_email_check
    check (
      application_email is null
      or application_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    ),
  constraint jobs_application_method_check
    check (
      status = 'draft'
      or application_url is not null
      or application_email is not null
    ),
  constraint jobs_expiry_check
    check (expires_at is null or expires_at > created_at),
  constraint jobs_views_count_check
    check (views_count >= 0),
  constraint jobs_applications_count_check
    check (applications_count >= 0)
);

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

create index if not exists jobs_search_vector_idx
  on public.jobs using gin (search_vector);

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

drop policy if exists "Published jobs are readable by everyone" on public.jobs;
create policy "Published jobs are readable by everyone"
  on public.jobs
  for select
  to anon, authenticated
  using (
    status = 'published'
    and published_at is not null
    and (expires_at is null or expires_at > now())
  );

drop policy if exists "Recruiters can read their own jobs" on public.jobs;
create policy "Recruiters can read their own jobs"
  on public.jobs
  for select
  to authenticated
  using (created_by = auth.uid());

drop policy if exists "Recruiters can create their own jobs" on public.jobs;
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

drop policy if exists "Recruiters can update their own jobs" on public.jobs;
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

drop policy if exists "Recruiters can delete their own drafts" on public.jobs;
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

comment on table public.jobs is
  'Production job posting foundation. Public users read published jobs, recruiters own draft and submitted jobs, service-role/admin workflows can moderate publishing.';

comment on column public.jobs.created_by is
  'Authenticated recruiter who owns this job.';

comment on column public.jobs.slug is
  'Unique URL slug generated from title, location, and a random suffix.';

comment on column public.jobs.status is
  'Allowed lifecycle values: draft, pending, published, closed, archived.';

comment on column public.jobs.views_count is
  'Nonnegative public view counter reserved for future analytics.';

comment on column public.jobs.applications_count is
  'Nonnegative application counter reserved for future applications.';
