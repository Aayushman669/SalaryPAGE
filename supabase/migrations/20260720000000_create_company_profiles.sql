begin;

set local search_path = public, storage, extensions, pg_catalog, pg_temp;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null,
  logo_path text,
  banner_path text,
  about text,
  website text,
  industry text,
  company_size text,
  founded_year integer,
  headquarters text,
  contact_email text,
  contact_phone text,
  linkedin_url text,
  x_url text,
  facebook_url text,
  work_model text,
  benefits text[] not null default '{}'::text[],
  verification_status text not null default 'unverified',
  profile_completion integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_name_length_check
    check (char_length(trim(name)) between 2 and 140),
  constraint companies_slug_format_check
    check (
      char_length(trim(slug)) between 3 and 160
      and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  constraint companies_about_length_check
    check (about is null or char_length(about) <= 8000),
  constraint companies_industry_length_check
    check (industry is null or char_length(trim(industry)) between 2 and 120),
  constraint companies_size_check
    check (
      company_size is null
      or company_size in ('1-10', '11-50', '51-200', '201-500', '501-1000', '1001+')
    ),
  constraint companies_founded_year_check
    check (
      founded_year is null
      or founded_year between 1800 and extract(year from now())::integer + 1
    ),
  constraint companies_work_model_check
    check (work_model is null or work_model in ('remote', 'hybrid', 'on_site')),
  constraint companies_verification_status_check
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  constraint companies_profile_completion_check
    check (profile_completion between 0 and 100)
);

create unique index if not exists companies_recruiter_id_key
  on public.companies (recruiter_id);

create unique index if not exists companies_slug_key
  on public.companies (slug);

create index if not exists companies_verification_status_idx
  on public.companies (verification_status, updated_at desc);

create or replace function public.set_company_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_company_profile_completion()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  completed_fields integer := 0;
  total_fields integer := 12;
begin
  completed_fields := completed_fields
    + case when char_length(trim(coalesce(new.name, ''))) > 0 then 1 else 0 end
    + case when char_length(trim(coalesce(new.slug, ''))) > 0 then 1 else 0 end
    + case when char_length(trim(coalesce(new.about, ''))) > 0 then 1 else 0 end
    + case when char_length(trim(coalesce(new.industry, ''))) > 0 then 1 else 0 end
    + case when new.company_size is not null then 1 else 0 end
    + case when new.work_model is not null then 1 else 0 end
    + case when char_length(trim(coalesce(new.headquarters, ''))) > 0 then 1 else 0 end
    + case when char_length(trim(coalesce(new.contact_email, ''))) > 0 then 1 else 0 end
    + case when char_length(trim(coalesce(new.website, ''))) > 0 then 1 else 0 end
    + case when char_length(trim(coalesce(new.logo_path, ''))) > 0 then 1 else 0 end
    + case when char_length(trim(coalesce(new.banner_path, ''))) > 0 then 1 else 0 end
    + case when coalesce(cardinality(new.benefits), 0) > 0 then 1 else 0 end;

  new.profile_completion := round((completed_fields::numeric / total_fields) * 100)::integer;
  return new;
end;
$$;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_company_updated_at();

drop trigger if exists companies_set_profile_completion on public.companies;
create trigger companies_set_profile_completion
before insert or update on public.companies
for each row execute function public.set_company_profile_completion();

alter table public.jobs
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists jobs_company_id_idx
  on public.jobs (company_id)
  where company_id is not null;

create or replace function public.validate_job_company_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id is not null
    and not exists (
      select 1
      from public.companies
      where companies.id = new.company_id
        and companies.recruiter_id = new.created_by
    ) then
    raise exception 'company_owner_mismatch'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_job_company_owner_before_write on public.jobs;
create trigger validate_job_company_owner_before_write
before insert or update of company_id, created_by on public.jobs
for each row execute function public.validate_job_company_owner();

revoke all on function public.validate_job_company_owner() from public, anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'company-assets',
  'company-assets',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id)
do update set
  public = false,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];

grant select, insert, update on public.companies to authenticated;

alter table public.companies enable row level security;

drop policy if exists "Recruiters can read their own company" on public.companies;
create policy "Recruiters can read their own company"
  on public.companies
  for select
  to authenticated
  using (recruiter_id = auth.uid() or public.is_admin_actor());

drop policy if exists "Recruiters can create their own company" on public.companies;
create policy "Recruiters can create their own company"
  on public.companies
  for insert
  to authenticated
  with check (
    recruiter_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    )
  );

drop policy if exists "Recruiters can update their own company" on public.companies;
create policy "Recruiters can update their own company"
  on public.companies
  for update
  to authenticated
  using (recruiter_id = auth.uid() or public.is_admin_actor())
  with check (recruiter_id = auth.uid() or public.is_admin_actor());

drop policy if exists "Admins can manage companies" on public.companies;
create policy "Admins can manage companies"
  on public.companies
  for all
  to authenticated
  using (public.is_admin_actor())
  with check (public.is_admin_actor());

drop policy if exists "Recruiters can upload company assets" on storage.objects;
create policy "Recruiters can upload company assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~* '^[0-9a-f-]{36}/(logo|banner)\.(jpg|jpeg|png|webp)$'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    )
  );

drop policy if exists "Recruiters can read their company assets" on storage.objects;
create policy "Recruiters can read their company assets"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Recruiters can update their company assets" on storage.objects;
create policy "Recruiters can update their company assets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~* '^[0-9a-f-]{36}/(logo|banner)\.(jpg|jpeg|png|webp)$'
  );

drop policy if exists "Recruiters can delete their company assets" on storage.objects;
create policy "Recruiters can delete their company assets"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on table public.companies is
  'One recruiter-owned company profile reused by recruiter workflows and future public company surfaces.';

comment on column public.companies.recruiter_id is
  'The single authenticated recruiter owner of this company profile.';

comment on column public.companies.profile_completion is
  'Application-calculated completion percentage from 0 to 100; not supplied by untrusted clients.';

commit;
