begin;

set local search_path = public, storage, extensions, pg_catalog, pg_temp;

-- Corrective migration for databases that already applied the initial
-- candidate profile migration. Qualify the target column so Postgres cannot
-- confuse it with candidate_id values from related application rows.
drop policy if exists "Candidates can read their own candidate profile"
  on public.candidate_profiles;

create policy "Candidates can read their own candidate profile"
  on public.candidate_profiles
  for select to authenticated
  using (candidate_profiles.candidate_id = auth.uid());

drop policy if exists "Recruiters can read applicant candidate profiles"
  on public.candidate_profiles;

create policy "Recruiters can read applicant candidate profiles"
  on public.candidate_profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.applications as application_rows
      inner join public.jobs as job_rows
        on job_rows.id = application_rows.job_id
      where application_rows.candidate_id = candidate_profiles.candidate_id
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
    )
    and exists (
      select 1
      from public.profiles as actor_profile
      where actor_profile.id = auth.uid()
        and actor_profile.role_mode = 'recruiter'
        and actor_profile.profile_completed = true
    )
  );

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
    cp.candidate_id,
    cp.professional_headline,
    cp.about_me,
    cp.skills,
    cp.experience,
    cp.education,
    cp.location,
    cp.portfolio_url,
    cp.linkedin_url,
    cp.github_url,
    cp.profile_photo_path,
    cp.resume_path,
    cp.preferred_job_title,
    cp.preferred_location,
    cp.work_preference,
    cp.years_of_experience,
    cp.profile_completion,
    cp.created_at,
    cp.updated_at
  from public.candidate_profiles as cp
  where cp.candidate_id = p_candidate_id
    and exists (
      select 1
      from public.applications as application_rows
      inner join public.jobs as job_rows
        on job_rows.id = application_rows.job_id
      where application_rows.candidate_id = p_candidate_id
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
    )
    and exists (
      select 1
      from public.profiles as actor_profile
      where actor_profile.id = auth.uid()
        and actor_profile.role_mode = 'recruiter'
        and actor_profile.profile_completed = true
    );
$$;

revoke all on function public.get_recruiter_candidate_profile(uuid)
  from public, anon, authenticated;
grant execute on function public.get_recruiter_candidate_profile(uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
