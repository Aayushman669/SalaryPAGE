begin;

set local search_path = public, storage, pg_catalog, pg_temp;

-- Candidate privacy is an additional restriction on top of the existing
-- application ownership check. Missing preference rows remain privacy-safe
-- for public discovery while preserving the existing applicant workflow.
create or replace function public.recruiter_can_access_candidate_asset(
  p_candidate_id text,
  p_asset_kind text default 'profile'
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  selected_visibility text;
begin
  if auth.uid() is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles as recruiter_profile
    where recruiter_profile.id = auth.uid()
      and recruiter_profile.role_mode = 'recruiter'
      and recruiter_profile.profile_completed = true
      and recruiter_profile.moderation_status = 'active'
  ) then
    return false;
  end if;

  if not exists (
    select 1
    from public.applications as application_rows
    inner join public.jobs as job_rows
      on job_rows.id = application_rows.job_id
    where application_rows.candidate_id::text = p_candidate_id
      and application_rows.recruiter_id = auth.uid()
      and job_rows.created_by = auth.uid()
  ) then
    return false;
  end if;

  select case
    when p_asset_kind = 'resume' then privacy.resume_visibility
    else privacy.profile_visibility
  end
  into selected_visibility
  from public.candidate_privacy_settings as privacy
  where privacy.candidate_id::text = p_candidate_id;

  return coalesce(selected_visibility, 'application_only') = 'application_only';
end;
$$;

revoke all on function public.recruiter_can_access_candidate_asset(text, text)
  from public, anon, authenticated;
grant execute on function public.recruiter_can_access_candidate_asset(text, text)
  to authenticated;

drop policy if exists "Recruiters can read applicant candidate profiles"
  on public.candidate_profiles;

create policy "Recruiters can read applicant candidate profiles"
  on public.candidate_profiles
  for select to authenticated
  using (
    public.recruiter_can_access_candidate_asset(
      candidate_profiles.candidate_id::text,
      'profile'
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
    case
      when public.recruiter_can_access_candidate_asset(p_candidate_id::text, 'resume')
        then candidate_profile_row.resume_path
      else null::text
    end as resume_path,
    candidate_profile_row.preferred_job_title,
    candidate_profile_row.preferred_location,
    candidate_profile_row.work_preference,
    candidate_profile_row.years_of_experience,
    candidate_profile_row.profile_completion,
    candidate_profile_row.created_at,
    candidate_profile_row.updated_at
  from public.candidate_profiles as candidate_profile_row
  where candidate_profile_row.candidate_id = p_candidate_id
    and public.recruiter_can_access_candidate_asset(
      p_candidate_id::text,
      'profile'
    );
$$;

revoke all on function public.get_recruiter_candidate_profile(uuid)
  from public, anon, authenticated;
grant execute on function public.get_recruiter_candidate_profile(uuid)
  to authenticated;

drop policy if exists "Candidates and recruiters can read profile assets"
  on storage.objects;

create policy "Candidates and recruiters can read profile assets"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'candidate-profile-assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.recruiter_can_access_candidate_asset(
        (storage.foldername(name))[1],
        (storage.foldername(name))[2]
      )
      or public.is_admin_actor()
    )
  );

notify pgrst, 'reload schema';

commit;
