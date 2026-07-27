begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- The original Day 7 candidate-profile migration used candidate_id in scopes
-- that can also contain the application candidate_id column. Recreate the
-- policies and RPC with explicit relation aliases. This is additive and does
-- not alter candidate profile data or table structure.
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
    candidate_profile_row.candidate_id,
    candidate_profile_row.professional_headline,
    candidate_profile_row.about_me,
    candidate_profile_row.skills,
    candidate_profile_row.experience,
    candidate_profile_row.education,
    candidate_profile_row.location,
    candidate_profile_row.portfolio_url,
    candidate_profile_row.linkedin_url,
    candidate_profile_row.github_url,
    candidate_profile_row.profile_photo_path,
    candidate_profile_row.resume_path,
    candidate_profile_row.preferred_job_title,
    candidate_profile_row.preferred_location,
    candidate_profile_row.work_preference,
    candidate_profile_row.years_of_experience,
    candidate_profile_row.profile_completion,
    candidate_profile_row.created_at,
    candidate_profile_row.updated_at
  from public.candidate_profiles as candidate_profile_row
  where candidate_profile_row.candidate_id = p_candidate_id
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

-- Qualify the related application ownership policies as well. These policies
-- are evaluated while candidate dashboard/profile queries traverse application
-- relationships, so leaving candidate_id bare keeps the same ambiguity risk.
drop policy if exists "Candidates can create their own applications"
  on public.applications;

create policy "Candidates can create their own applications"
  on public.applications
  for insert to authenticated
  with check (
    applications.candidate_id = auth.uid()
    and applications.status = 'applied'
    and exists (
      select 1
      from public.profiles as candidate_profile_owner
      where candidate_profile_owner.id = auth.uid()
        and candidate_profile_owner.role_mode = 'job_seeker'
        and candidate_profile_owner.profile_completed = true
        and candidate_profile_owner.moderation_status = 'active'
    )
  );

drop policy if exists "Candidates can read their own applications"
  on public.applications;

create policy "Candidates can read their own applications"
  on public.applications
  for select to authenticated
  using (applications.candidate_id = auth.uid());

drop policy if exists "Candidates can withdraw their own applications"
  on public.applications;

create policy "Candidates can withdraw their own applications"
  on public.applications
  for update to authenticated
  using (
    applications.candidate_id = auth.uid()
    and applications.status <> 'withdrawn'
    and exists (
      select 1
      from public.profiles as candidate_profile_owner
      where candidate_profile_owner.id = auth.uid()
        and candidate_profile_owner.moderation_status = 'active'
    )
  )
  with check (
    applications.candidate_id = auth.uid()
    and applications.status = 'withdrawn'
  );

drop policy if exists "Recruiters can update status for their applications"
  on public.applications;

create policy "Recruiters can update status for their applications"
  on public.applications
  for update to authenticated
  using (
    applications.recruiter_id = auth.uid()
    and exists (
      select 1
      from public.profiles as recruiter_profile
      where recruiter_profile.id = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
        and recruiter_profile.moderation_status = 'active'
    )
  )
  with check (applications.recruiter_id = auth.uid());

notify pgrst, 'reload schema';

commit;
