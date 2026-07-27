begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- Recruiter settings live on the existing profile and preference records.
alter table public.profiles
  add column if not exists job_title text,
  add column if not exists department text,
  add column if not exists phone text,
  add column if not exists location text,
  add column if not exists bio text,
  add column if not exists linkedin_url text,
  add column if not exists recruiter_avatar_path text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_recruiter_settings_lengths_check'
  ) then
    alter table public.profiles
      add constraint profiles_recruiter_settings_lengths_check
      check (
        (job_title is null or char_length(job_title) <= 160)
        and (department is null or char_length(department) <= 160)
        and (phone is null or char_length(phone) <= 40)
        and (location is null or char_length(location) <= 160)
        and (bio is null or char_length(bio) <= 4000)
        and (linkedin_url is null or char_length(linkedin_url) <= 500)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_recruiter_linkedin_url_check'
  ) then
    alter table public.profiles
      add constraint profiles_recruiter_linkedin_url_check
      check (linkedin_url is null or linkedin_url ~* '^https?://') not valid;
  end if;
end;
$$;

alter table public.email_preferences
  add column if not exists new_application_email boolean not null default true,
  add column if not exists new_application_in_app boolean not null default true,
  add column if not exists candidate_status_updates_email boolean not null default true,
  add column if not exists candidate_status_updates_in_app boolean not null default true,
  add column if not exists interview_reminders_email boolean not null default true,
  add column if not exists interview_reminders_in_app boolean not null default true,
  add column if not exists interview_rescheduled_email boolean not null default true,
  add column if not exists interview_rescheduled_in_app boolean not null default true,
  add column if not exists interview_cancelled_email boolean not null default true,
  add column if not exists interview_cancelled_in_app boolean not null default true,
  add column if not exists job_expiry_reminders_email boolean not null default true,
  add column if not exists job_expiry_reminders_in_app boolean not null default true;

create or replace function public.update_recruiter_profile(
  p_full_name text,
  p_job_title text default null,
  p_department text default null,
  p_phone text default null,
  p_location text default null,
  p_bio text default null,
  p_linkedin_url text default null,
  p_recruiter_avatar_path text default null
)
returns table (
  id uuid,
  full_name text,
  email text,
  role_mode text,
  current_plan text,
  profile_completed boolean,
  avatar_url text,
  moderation_status text,
  job_title text,
  department text,
  phone text,
  location text,
  bio text,
  linkedin_url text,
  recruiter_avatar_path text
)
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  normalized_name text := nullif(trim(coalesce(p_full_name, '')), '');
  normalized_linkedin text := nullif(trim(coalesce(p_linkedin_url, '')), '');
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 2 and 120 then
    raise exception 'full_name_invalid' using errcode = '22023';
  end if;

  if normalized_linkedin is not null and normalized_linkedin !~* '^https?://' then
    raise exception 'linkedin_url_invalid' using errcode = '22023';
  end if;

  if p_recruiter_avatar_path is not null
     and p_recruiter_avatar_path !~* ('^' || actor_id::text || '/avatar/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then
    raise exception 'avatar_path_invalid' using errcode = '22023';
  end if;

  return query
  update public.profiles as recruiter_profile
  set
    full_name = normalized_name,
    job_title = nullif(trim(coalesce(p_job_title, '')), ''),
    department = nullif(trim(coalesce(p_department, '')), ''),
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    location = nullif(trim(coalesce(p_location, '')), ''),
    bio = nullif(trim(coalesce(p_bio, '')), ''),
    linkedin_url = normalized_linkedin,
    recruiter_avatar_path = p_recruiter_avatar_path
  where recruiter_profile.id = actor_id
    and recruiter_profile.role_mode = 'recruiter'
  returning
    recruiter_profile.id,
    recruiter_profile.full_name,
    recruiter_profile.email,
    recruiter_profile.role_mode,
    recruiter_profile.current_plan,
    recruiter_profile.profile_completed,
    recruiter_profile.avatar_url,
    recruiter_profile.moderation_status,
    recruiter_profile.job_title,
    recruiter_profile.department,
    recruiter_profile.phone,
    recruiter_profile.location,
    recruiter_profile.bio,
    recruiter_profile.linkedin_url,
    recruiter_profile.recruiter_avatar_path;
end;
$$;

revoke all on function public.update_recruiter_profile(text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_recruiter_profile(text, text, text, text, text, text, text, text)
  to authenticated;

drop policy if exists "Recruiters can read their deletion requests"
  on public.account_deletion_requests;
create policy "Recruiters can read their deletion requests"
  on public.account_deletion_requests
  for select to authenticated
  using (
    account_deletion_requests.user_id = auth.uid()
    and exists (
      select 1 from public.profiles as recruiter_profile
      where recruiter_profile.id = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
    )
  );

drop policy if exists "Recruiters can create their deletion requests"
  on public.account_deletion_requests;
create policy "Recruiters can create their deletion requests"
  on public.account_deletion_requests
  for insert to authenticated
  with check (
    account_deletion_requests.user_id = auth.uid()
    and exists (
      select 1 from public.profiles as recruiter_profile
      where recruiter_profile.id = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
    )
  );

create or replace function public.get_recruiter_account_deletion_request()
returns table (
  id uuid,
  reason text,
  status text,
  requested_at timestamptz
)
language sql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select requests.id, requests.reason, requests.status, requests.requested_at
  from public.account_deletion_requests as requests
  where requests.user_id = auth.uid()
    and exists (
      select 1 from public.profiles as recruiter_profile
      where recruiter_profile.id = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
    )
  order by requests.requested_at desc
  limit 1;
$$;

create or replace function public.request_recruiter_account_deletion(p_reason text default null)
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
  actor_id uuid := auth.uid();
  created_request public.account_deletion_requests;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles as recruiter_profile
    where recruiter_profile.id = actor_id
      and recruiter_profile.role_mode = 'recruiter'
  ) then
    raise exception 'recruiter_required' using errcode = '42501';
  end if;

  insert into public.account_deletion_requests (user_id, reason)
  values (actor_id, nullif(left(trim(coalesce(p_reason, '')), 4000), ''))
  returning * into created_request;

  return query select created_request.id, created_request.reason, created_request.status, created_request.requested_at;
exception
  when unique_violation then
    raise exception 'deletion_request_already_exists' using errcode = '23505';
end;
$$;

revoke all on function public.get_recruiter_account_deletion_request() from public, anon, authenticated;
revoke all on function public.request_recruiter_account_deletion(text) from public, anon, authenticated;
grant execute on function public.get_recruiter_account_deletion_request() to authenticated;
grant execute on function public.request_recruiter_account_deletion(text) to authenticated;

-- Reuse the existing private profile-assets bucket for recruiter avatars.
drop policy if exists "Recruiters can upload profile avatars" on storage.objects;
create policy "Recruiters can upload profile avatars"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'candidate-profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~* ('^' || auth.uid()::text || '/avatar/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
    and exists (
      select 1 from public.profiles as recruiter_profile
      where recruiter_profile.id = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
    )
  );

notify pgrst, 'reload schema';

commit;
