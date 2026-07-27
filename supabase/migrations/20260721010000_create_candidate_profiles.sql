begin;

set local search_path = public, storage, extensions, pg_catalog, pg_temp;

-- Candidate-specific information lives beside, rather than inside, the shared
-- identity row in profiles. The candidate id is the primary key so each
-- candidate can have exactly one profile.
create table if not exists public.candidate_profiles (
  candidate_id uuid primary key references public.profiles(id) on delete cascade,
  professional_headline text,
  about_me text,
  skills text[] not null default '{}'::text[],
  experience text,
  education text,
  location text,
  portfolio_url text,
  linkedin_url text,
  github_url text,
  profile_photo_path text,
  resume_path text,
  preferred_job_title text,
  preferred_location text,
  work_preference text,
  years_of_experience integer,
  profile_completion integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.candidate_profiles
  add column if not exists professional_headline text,
  add column if not exists about_me text,
  add column if not exists skills text[] not null default '{}'::text[],
  add column if not exists experience text,
  add column if not exists education text,
  add column if not exists location text,
  add column if not exists portfolio_url text,
  add column if not exists linkedin_url text,
  add column if not exists github_url text,
  add column if not exists profile_photo_path text,
  add column if not exists resume_path text,
  add column if not exists preferred_job_title text,
  add column if not exists preferred_location text,
  add column if not exists work_preference text,
  add column if not exists years_of_experience integer,
  add column if not exists profile_completion integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.candidate_profiles
set
  skills = coalesce(skills, '{}'::text[]),
  profile_completion = greatest(least(coalesce(profile_completion, 0), 100), 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.candidate_profiles'::regclass
      and conname = 'candidate_profiles_work_preference_check'
  ) then
    alter table public.candidate_profiles
      add constraint candidate_profiles_work_preference_check
      check (work_preference is null or work_preference in ('remote', 'hybrid', 'on_site'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.candidate_profiles'::regclass
      and conname = 'candidate_profiles_years_experience_check'
  ) then
    alter table public.candidate_profiles
      add constraint candidate_profiles_years_experience_check
      check (years_of_experience is null or (years_of_experience >= 0 and years_of_experience <= 100))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.candidate_profiles'::regclass
      and conname = 'candidate_profiles_completion_check'
  ) then
    alter table public.candidate_profiles
      add constraint candidate_profiles_completion_check
      check (profile_completion between 0 and 100)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.candidate_profiles'::regclass
      and conname = 'candidate_profiles_skills_length_check'
  ) then
    alter table public.candidate_profiles
      add constraint candidate_profiles_skills_length_check
      check (cardinality(skills) <= 50)
      not valid;
  end if;
end;
$$;

create index if not exists candidate_profiles_location_idx
  on public.candidate_profiles (location);

create index if not exists candidate_profiles_work_preference_idx
  on public.candidate_profiles (work_preference);

create index if not exists candidate_profiles_updated_at_idx
  on public.candidate_profiles (updated_at desc, candidate_id desc);

create or replace function public.calculate_candidate_profile_completion(
  p_full_name text,
  p_professional_headline text,
  p_about_me text,
  p_skills text[],
  p_experience text,
  p_education text,
  p_location text,
  p_portfolio_url text,
  p_linkedin_url text,
  p_github_url text,
  p_profile_photo_path text,
  p_resume_path text,
  p_preferred_job_title text,
  p_preferred_location text,
  p_work_preference text,
  p_years_of_experience integer
)
returns integer
language sql
immutable
set search_path = public, pg_catalog, pg_temp
as $$
  select round((
    (case when nullif(trim(coalesce(p_full_name, '')), '') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p_professional_headline, '')), '') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p_about_me, '')), '') is not null then 1 else 0 end) +
    (case when coalesce(cardinality(p_skills), 0) > 0 then 1 else 0 end) +
    (case when nullif(trim(coalesce(p_experience, '')), '') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p_education, '')), '') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p_location, '')), '') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p_portfolio_url, '')), '') is not null
       or nullif(trim(coalesce(p_linkedin_url, '')), '') is not null
       or nullif(trim(coalesce(p_github_url, '')), '') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p_profile_photo_path, '')), '') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p_resume_path, '')), '') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p_preferred_job_title, '')), '') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(p_preferred_location, '')), '') is not null then 1 else 0 end) +
    (case when p_work_preference is not null then 1 else 0 end) +
    (case when p_years_of_experience is not null then 1 else 0 end)
  ) / 14.0 * 100)::integer;
$$;

create or replace function public.set_candidate_profile_updated_at()
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

drop trigger if exists candidate_profiles_set_updated_at on public.candidate_profiles;
create trigger candidate_profiles_set_updated_at
before update on public.candidate_profiles
for each row execute function public.set_candidate_profile_updated_at();

-- Existing job seekers receive an empty row, while onboarding and role
-- switching automatically create the row for future candidates.
insert into public.candidate_profiles (candidate_id, profile_completion)
select id, 0
from public.profiles
where role_mode = 'job_seeker'
on conflict (candidate_id) do nothing;

create or replace function public.ensure_candidate_profile_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if new.role_mode = 'job_seeker' then
    insert into public.candidate_profiles (candidate_id)
    values (new.id)
    on conflict (candidate_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_ensure_candidate_profile on public.profiles;
create trigger profiles_ensure_candidate_profile
after insert or update of role_mode on public.profiles
for each row execute function public.ensure_candidate_profile_row();

create or replace function public.upsert_candidate_profile(
  p_full_name text,
  p_professional_headline text default null,
  p_about_me text default null,
  p_skills text[] default '{}'::text[],
  p_experience text default null,
  p_education text default null,
  p_location text default null,
  p_portfolio_url text default null,
  p_linkedin_url text default null,
  p_github_url text default null,
  p_profile_photo_path text default null,
  p_resume_path text default null,
  p_preferred_job_title text default null,
  p_preferred_location text default null,
  p_work_preference text default null,
  p_years_of_experience integer default null
)
returns table (
  candidate_id uuid,
  professional_headline text,
  about_me text,
  skills text[],
  experience text,
  education text,
  location text,
  portfolio_url text,
  linkedin_url text,
  github_url text,
  profile_photo_path text,
  resume_path text,
  preferred_job_title text,
  preferred_location text,
  work_preference text,
  years_of_experience integer,
  profile_completion integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  actor_moderation_status text;
  normalized_name text := nullif(trim(coalesce(p_full_name, '')), '');
  normalized_skills text[] := coalesce(
    array(
      select distinct trim(skill)
      from unnest(coalesce(p_skills, '{}'::text[])) as skill
      where trim(skill) <> ''
      limit 50
    ),
    '{}'::text[]
  );
  normalized_completion integer;
begin
  if actor_id is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select profiles.role_mode, profiles.moderation_status
  into actor_role, actor_moderation_status
  from public.profiles
  where profiles.id = actor_id;

  if actor_role <> 'job_seeker' then
    raise exception 'A Job Seeker profile is required.' using errcode = '42501';
  end if;

  if actor_moderation_status in ('suspended', 'restricted') then
    raise exception 'Your account is currently restricted.' using errcode = '42501';
  end if;

  if normalized_name is null or char_length(normalized_name) < 2 or char_length(normalized_name) > 120 then
    raise exception 'Full name must be between 2 and 120 characters.' using errcode = '22023';
  end if;

  if char_length(coalesce(p_professional_headline, '')) > 160
     or char_length(coalesce(p_about_me, '')) > 8000
     or char_length(coalesce(p_experience, '')) > 12000
     or char_length(coalesce(p_education, '')) > 8000
     or char_length(coalesce(p_location, '')) > 160
     or char_length(coalesce(p_preferred_job_title, '')) > 160
     or char_length(coalesce(p_preferred_location, '')) > 160 then
    raise exception 'One or more candidate profile fields exceed their length limit.' using errcode = '22023';
  end if;

  if coalesce(cardinality(p_skills), 0) > 50
     or exists (
       select 1
       from unnest(coalesce(p_skills, '{}'::text[])) as skill
       where char_length(trim(skill)) > 80
     ) then
    raise exception 'Add no more than 50 skills, each 80 characters or fewer.' using errcode = '22023';
  end if;

  if p_work_preference is not null and p_work_preference not in ('remote', 'hybrid', 'on_site') then
    raise exception 'Choose a valid work preference.' using errcode = '22023';
  end if;

  if p_years_of_experience is not null and (p_years_of_experience < 0 or p_years_of_experience > 100) then
    raise exception 'Years of experience must be between 0 and 100.' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_portfolio_url, '')), '') is not null
     and trim(p_portfolio_url) !~* '^https?://' then
    raise exception 'Portfolio URL must use http or https.' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_linkedin_url, '')), '') is not null
     and trim(p_linkedin_url) !~* '^https?://' then
    raise exception 'LinkedIn URL must use http or https.' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_github_url, '')), '') is not null
     and trim(p_github_url) !~* '^https?://' then
    raise exception 'GitHub URL must use http or https.' using errcode = '22023';
  end if;

  if p_profile_photo_path is not null
     and p_profile_photo_path !~* ('^' || actor_id::text || '/photo/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then
    raise exception 'Invalid profile photo path.' using errcode = '22023';
  end if;

  if p_resume_path is not null
     and p_resume_path !~* ('^' || actor_id::text || '/resume/[0-9a-f-]{36}\.pdf$') then
    raise exception 'Invalid resume path.' using errcode = '22023';
  end if;

  normalized_completion := public.calculate_candidate_profile_completion(
    normalized_name,
    p_professional_headline,
    p_about_me,
    normalized_skills,
    p_experience,
    p_education,
    p_location,
    p_portfolio_url,
    p_linkedin_url,
    p_github_url,
    p_profile_photo_path,
    p_resume_path,
    p_preferred_job_title,
    p_preferred_location,
    p_work_preference,
    p_years_of_experience
  );

  update public.profiles
  set full_name = normalized_name
  where id = actor_id;

  insert into public.candidate_profiles (
    candidate_id,
    professional_headline,
    about_me,
    skills,
    experience,
    education,
    location,
    portfolio_url,
    linkedin_url,
    github_url,
    profile_photo_path,
    resume_path,
    preferred_job_title,
    preferred_location,
    work_preference,
    years_of_experience,
    profile_completion
  ) values (
    actor_id,
    nullif(trim(coalesce(p_professional_headline, '')), ''),
    nullif(trim(coalesce(p_about_me, '')), ''),
    normalized_skills,
    nullif(trim(coalesce(p_experience, '')), ''),
    nullif(trim(coalesce(p_education, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    nullif(trim(coalesce(p_portfolio_url, '')), ''),
    nullif(trim(coalesce(p_linkedin_url, '')), ''),
    nullif(trim(coalesce(p_github_url, '')), ''),
    nullif(trim(coalesce(p_profile_photo_path, '')), ''),
    nullif(trim(coalesce(p_resume_path, '')), ''),
    nullif(trim(coalesce(p_preferred_job_title, '')), ''),
    nullif(trim(coalesce(p_preferred_location, '')), ''),
    p_work_preference,
    p_years_of_experience,
    normalized_completion
  )
  on conflict (candidate_id) do update set
    professional_headline = excluded.professional_headline,
    about_me = excluded.about_me,
    skills = excluded.skills,
    experience = excluded.experience,
    education = excluded.education,
    location = excluded.location,
    portfolio_url = excluded.portfolio_url,
    linkedin_url = excluded.linkedin_url,
    github_url = excluded.github_url,
    profile_photo_path = excluded.profile_photo_path,
    resume_path = excluded.resume_path,
    preferred_job_title = excluded.preferred_job_title,
    preferred_location = excluded.preferred_location,
    work_preference = excluded.work_preference,
    years_of_experience = excluded.years_of_experience,
    profile_completion = excluded.profile_completion,
    updated_at = now();

  return query
  select
    profiles.candidate_id,
    profiles.professional_headline,
    profiles.about_me,
    profiles.skills,
    profiles.experience,
    profiles.education,
    profiles.location,
    profiles.portfolio_url,
    profiles.linkedin_url,
    profiles.github_url,
    profiles.profile_photo_path,
    profiles.resume_path,
    profiles.preferred_job_title,
    profiles.preferred_location,
    profiles.work_preference,
    profiles.years_of_experience,
    profiles.profile_completion,
    profiles.created_at,
    profiles.updated_at
  from public.candidate_profiles as profiles
  where profiles.candidate_id = actor_id;
end;
$$;

create or replace function public.get_recruiter_candidate_profile(p_candidate_id uuid)
returns table (
  candidate_id uuid,
  professional_headline text,
  about_me text,
  skills text[],
  experience text,
  education text,
  location text,
  portfolio_url text,
  linkedin_url text,
  github_url text,
  profile_photo_path text,
  resume_path text,
  preferred_job_title text,
  preferred_location text,
  work_preference text,
  years_of_experience integer,
  profile_completion integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    candidate_profiles.candidate_id,
    candidate_profiles.professional_headline,
    candidate_profiles.about_me,
    candidate_profiles.skills,
    candidate_profiles.experience,
    candidate_profiles.education,
    candidate_profiles.location,
    candidate_profiles.portfolio_url,
    candidate_profiles.linkedin_url,
    candidate_profiles.github_url,
    candidate_profiles.profile_photo_path,
    candidate_profiles.resume_path,
    candidate_profiles.preferred_job_title,
    candidate_profiles.preferred_location,
    candidate_profiles.work_preference,
    candidate_profiles.years_of_experience,
    candidate_profiles.profile_completion,
    candidate_profiles.created_at,
    candidate_profiles.updated_at
  from public.candidate_profiles
  where candidate_profiles.candidate_id = p_candidate_id
    and exists (
      select 1
      from public.applications
      inner join public.jobs on jobs.id = applications.job_id
      where applications.candidate_id = p_candidate_id
        and applications.recruiter_id = auth.uid()
        and jobs.created_by = auth.uid()
    )
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    );
$$;

revoke all on public.candidate_profiles from public, anon, authenticated;
grant select on public.candidate_profiles to authenticated;

alter table public.candidate_profiles enable row level security;

drop policy if exists "Candidates can read their own candidate profile" on public.candidate_profiles;
create policy "Candidates can read their own candidate profile"
  on public.candidate_profiles
  for select to authenticated
  using (candidate_profiles.candidate_id = auth.uid());

drop policy if exists "Recruiters can read applicant candidate profiles" on public.candidate_profiles;
create policy "Recruiters can read applicant candidate profiles"
  on public.candidate_profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.applications
      inner join public.jobs on jobs.id = applications.job_id
      where applications.candidate_id = candidate_profiles.candidate_id
        and applications.recruiter_id = auth.uid()
        and jobs.created_by = auth.uid()
    )
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    )
  );

drop policy if exists "Admins can read candidate profiles" on public.candidate_profiles;
create policy "Admins can read candidate profiles"
  on public.candidate_profiles
  for select to authenticated
  using (public.is_admin_actor());

revoke all on function public.calculate_candidate_profile_completion(text, text, text, text[], text, text, text, text, text, text, text, text, text, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.upsert_candidate_profile(text, text, text, text[], text, text, text, text, text, text, text, text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.upsert_candidate_profile(text, text, text, text[], text, text, text, text, text, text, text, text, text, text, text, integer)
  to authenticated;
revoke all on function public.get_recruiter_candidate_profile(uuid) from public, anon, authenticated;
grant execute on function public.get_recruiter_candidate_profile(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-profile-assets',
  'candidate-profile-assets',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 8388608,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Candidates can upload their profile assets" on storage.objects;
create policy "Candidates can upload their profile assets"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'candidate-profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~* ('^' || auth.uid()::text || '/(photo/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)|resume/[0-9a-f-]{36}\.pdf)$')
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'job_seeker'
        and profiles.profile_completed = true
    )
  );

drop policy if exists "Candidates and recruiters can read profile assets" on storage.objects;
create policy "Candidates and recruiters can read profile assets"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'candidate-profile-assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.applications
        inner join public.jobs on jobs.id = applications.job_id
        where applications.candidate_id::text = (storage.foldername(name))[1]
          and applications.recruiter_id = auth.uid()
          and jobs.created_by = auth.uid()
      )
      or public.is_admin_actor()
    )
  );

drop policy if exists "Candidates can update their profile assets" on storage.objects;
create policy "Candidates can update their profile assets"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'candidate-profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'candidate-profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Candidates can delete their profile assets" on storage.objects;
create policy "Candidates can delete their profile assets"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'candidate-profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on table public.candidate_profiles is
  'Candidate-owned professional profile data. Resume paths remain private storage references.';
comment on function public.upsert_candidate_profile(text, text, text, text[], text, text, text, text, text, text, text, text, text, text, text, integer) is
  'Authenticated Job Seeker write path. Derives ownership from auth.uid() and calculates completion server-side.';

notify pgrst, 'reload schema';

commit;
