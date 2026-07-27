begin;

set local search_path = public, pg_catalog, pg_temp;

-- Profile authorization and entitlement fields must never be client-controlled.
-- The trigger allows only the initial, incomplete profile seed for a signed-in
-- user; later role, completion, moderation, and plan changes stay server-side.
create or replace function public.prevent_client_profile_authorization_changes()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin')
    or public.is_admin_actor() then
    return new;
  end if;

  if auth.uid() is null or new.id is distinct from auth.uid() then
    raise exception 'profile_identity_is_server_managed' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.role_mode is not null
      or coalesce(new.profile_completed, false) is distinct from false
      or coalesce(new.current_plan, 'free') <> 'free'
      or coalesce(new.moderation_status, 'active') <> 'active' then
      raise exception 'profile_authorization_fields_are_server_managed' using errcode = '42501';
    end if;

    if new.email is distinct from (
      select users.email from auth.users as users where users.id = auth.uid()
    ) then
      raise exception 'profile_email_changes_must_use_auth' using errcode = '42501';
    end if;

    return new;
  end if;

  if new.email is distinct from old.email then
    raise exception 'profile_email_changes_must_use_auth' using errcode = '42501';
  end if;

  if new.role_mode is distinct from old.role_mode then
    if old.role_mode is not null
      or old.profile_completed is true
      or new.role_mode not in ('recruiter', 'job_seeker') then
      raise exception 'profile_role_changes_are_admin_only' using errcode = '42501';
    end if;
  end if;

  if new.profile_completed is distinct from old.profile_completed then
    if old.profile_completed is true
      or new.profile_completed is distinct from true
      or new.role_mode not in ('recruiter', 'job_seeker') then
      raise exception 'profile_completion_is_server_managed' using errcode = '42501';
    end if;
  end if;

  if new.current_plan is distinct from old.current_plan
    or new.moderation_status is distinct from old.moderation_status then
    raise exception 'profile_authorization_fields_are_server_managed' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_client_profile_authorization_changes_before_update
  on public.profiles;
create trigger prevent_client_profile_authorization_changes_before_insert_or_update
before insert or update on public.profiles
for each row execute function public.prevent_client_profile_authorization_changes();

revoke all on function public.prevent_client_profile_authorization_changes()
  from public, anon, authenticated;

-- Candidate profile rows contain private storage paths. Keep direct table reads
-- disabled and expose only the signed-in candidate's own row through a narrow RPC.
create or replace function public.get_candidate_profile()
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
  where candidate_profiles.candidate_id = auth.uid();
$$;

revoke all on function public.get_candidate_profile() from public, anon, authenticated;
grant execute on function public.get_candidate_profile() to authenticated;

-- Recruiters and candidates must use the scoped RPCs. Service-role server
-- modules retain their existing trusted access for moderation and support flows.
revoke all on public.candidate_profiles from public, anon, authenticated;

-- Keep private resume objects addressable only through the valid object path
-- shapes produced by the application and by the owning application record.
drop policy if exists "Candidates can read their own application resumes"
  on storage.objects;
create policy "Candidates can read their own application resumes"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'application-resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~* ('^' || auth.uid()::text || '/[a-z0-9-]+/[a-z0-9-]+\.pdf$')
  );

drop policy if exists "Recruiters can read resumes for their applications"
  on storage.objects;
create policy "Recruiters can read resumes for their applications"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'application-resumes'
    and name ~* '^[0-9a-f-]{36}/[a-z0-9-]+/[a-z0-9-]+\.pdf$'
    and exists (
      select 1
      from public.applications as application_rows
      inner join public.jobs as job_rows
        on job_rows.id = application_rows.job_id
      where application_rows.resume_url = storage.objects.name
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
    )
    and exists (
      select 1
      from public.profiles as recruiter_profile
      where recruiter_profile.id = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
        and recruiter_profile.moderation_status = 'active'
    )
  );

drop policy if exists "Candidates can delete their own unsubmitted resumes"
  on storage.objects;
create policy "Candidates can delete their own unsubmitted resumes"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'application-resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~* ('^' || auth.uid()::text || '/[a-z0-9-]+/[a-z0-9-]+\.pdf$')
    and not exists (
      select 1
      from public.applications
      where applications.resume_url = storage.objects.name
    )
  );

drop policy if exists "Candidates and recruiters can read profile assets"
  on storage.objects;
create policy "Candidates and recruiters can read profile assets"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'candidate-profile-assets'
    and (
      (
        (storage.foldername(name))[1] = auth.uid()::text
        and name ~* (
          '^' || auth.uid()::text ||
          '/(photo/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)|resume/[0-9a-f-]{36}\.pdf|avatar/[0-9a-f-]{36}\.(jpg|jpeg|png|webp))$'
        )
      )
      or (
        name ~* '^[0-9a-f-]{36}/(photo/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)|resume/[0-9a-f-]{36}\.pdf|avatar/[0-9a-f-]{36}\.(jpg|jpeg|png|webp))$'
        and public.recruiter_can_access_candidate_asset(
          (storage.foldername(name))[1],
          (storage.foldername(name))[2]
        )
      )
      or public.is_admin_actor()
    )
  );

notify pgrst, 'reload schema';

commit;
