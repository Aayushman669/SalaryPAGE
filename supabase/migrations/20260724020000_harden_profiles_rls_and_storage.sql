begin;

set local search_path = public, storage, extensions, pg_catalog, pg_temp;

-- profiles is an existing user-owned table. The restrictive policy remains
-- effective even if an older permissive policy exists in a deployed database.
alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Profiles own-row security boundary" on public.profiles;
create policy "Profiles own-row security boundary"
  on public.profiles
  as restrictive
  for all
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Authenticated users can read their own profile" on public.profiles;
create policy "Authenticated users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Authenticated users can create their own profile" on public.profiles;
create policy "Authenticated users can create their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Authenticated users can update their own profile" on public.profiles;
create policy "Authenticated users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Keep the shared private profile-assets bucket, but constrain every update to
-- a path shape owned by the current account. Inserts already use these shapes.
drop policy if exists "Candidates can update their profile assets" on storage.objects;
create policy "Candidates can update their profile assets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'candidate-profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~* (
      '^' || auth.uid()::text ||
      '/(photo/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)|resume/[0-9a-f-]{36}\.pdf|avatar/[0-9a-f-]{36}\.(jpg|jpeg|png|webp))$'
    )
  )
  with check (
    bucket_id = 'candidate-profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~* (
      '^' || auth.uid()::text ||
      '/(photo/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)|resume/[0-9a-f-]{36}\.pdf|avatar/[0-9a-f-]{36}\.(jpg|jpeg|png|webp))$'
    )
  );

-- Uploads are unavailable to suspended or restricted accounts. The object
-- bucket remains private and read/delete ownership rules are preserved.
drop policy if exists "Candidates can upload their profile assets" on storage.objects;
create policy "Candidates can upload their profile assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'candidate-profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~* (
      '^' || auth.uid()::text ||
      '/(photo/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)|resume/[0-9a-f-]{36}\.pdf)$'
    )
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'job_seeker'
        and profiles.profile_completed = true
        and profiles.moderation_status = 'active'
    )
  );

drop policy if exists "Candidates can upload their own application resumes" on storage.objects;
create policy "Candidates can upload their own application resumes"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'application-resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~* '^[0-9a-f-]{36}/[a-z0-9-]+/[a-z0-9-]+\.pdf$'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'job_seeker'
        and profiles.profile_completed = true
        and profiles.moderation_status = 'active'
    )
  );

drop policy if exists "Recruiters can upload profile avatars" on storage.objects;
create policy "Recruiters can upload profile avatars"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'candidate-profile-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~* ('^' || auth.uid()::text || '/avatar/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
        and profiles.moderation_status = 'active'
    )
  );

drop policy if exists "Recruiters can upload company assets" on storage.objects;
create policy "Recruiters can upload company assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      name ~* '^[0-9a-f-]{36}/(logo|banner)\.(jpg|jpeg|png|webp)$'
      or name ~* '^[0-9a-f-]{36}/gallery/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    )
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
        and profiles.moderation_status = 'active'
    )
    and exists (
      select 1
      from public.companies
      where companies.recruiter_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';

commit;
