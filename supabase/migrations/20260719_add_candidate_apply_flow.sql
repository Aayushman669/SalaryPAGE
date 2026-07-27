begin;

set local search_path = public, storage, extensions, pg_catalog, pg_temp;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'application-resumes',
  'application-resumes',
  false,
  5242880,
  array['application/pdf']::text[]
)
on conflict (id)
do update
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf']::text[];

drop policy if exists "Candidates can upload their own application resumes"
  on storage.objects;

create policy "Candidates can upload their own application resumes"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'application-resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(right(name, 4)) = '.pdf'
  );

drop policy if exists "Candidates can read their own application resumes"
  on storage.objects;

create policy "Candidates can read their own application resumes"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'application-resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Candidates can delete their own unsubmitted resumes"
  on storage.objects;

create policy "Candidates can delete their own unsubmitted resumes"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'application-resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Recruiters can read resumes for their applications"
  on storage.objects;

create policy "Recruiters can read resumes for their applications"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'application-resumes'
    and exists (
      select 1
      from public.applications
      where applications.resume_url = storage.objects.name
        and applications.recruiter_id = auth.uid()
    )
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    )
  );

create or replace function public.get_candidate_application_for_job_slug(
  p_job_slug text
)
returns table (
  has_applied boolean,
  status text,
  applied_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with existing_application as (
    select
      applications.status,
      applications.applied_at
    from public.applications
    inner join public.jobs
      on jobs.id = applications.job_id
    where auth.uid() is not null
      and applications.candidate_id = auth.uid()
      and jobs.slug = trim(p_job_slug)
    order by applications.applied_at desc
    limit 1
  )
  select
    true,
    existing_application.status,
    existing_application.applied_at
  from existing_application
  union all
  select
    false,
    null::text,
    null::timestamptz
  where not exists (select 1 from existing_application);
$$;

create or replace function public.apply_to_published_job(
  p_job_slug text,
  p_resume_path text,
  p_cover_letter text default '',
  p_answers jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, storage, extensions, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  inserted_application_id uuid;
  normalized_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  normalized_cover_letter text := left(coalesce(p_cover_letter, ''), 12000);
  normalized_resume_path text := trim(coalesce(p_resume_path, ''));
  normalized_slug text := trim(coalesce(p_job_slug, ''));
  target_job_id uuid;
  target_recruiter_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated'
      using errcode = '28000';
  end if;

  if normalized_slug = '' then
    raise exception 'job_not_available'
      using errcode = 'P0001';
  end if;

  if normalized_resume_path = ''
    or left(normalized_resume_path, length(current_user_id::text) + 1) <> current_user_id::text || '/'
    or lower(normalized_resume_path) not like '%.pdf'
  then
    raise exception 'invalid_resume'
      using errcode = 'P0001';
  end if;

  if jsonb_typeof(normalized_answers) <> 'object' then
    raise exception 'invalid_answers'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = current_user_id
      and profiles.role_mode = 'job_seeker'
      and profiles.profile_completed = true
  ) then
    raise exception 'job_seeker_required'
      using errcode = '42501';
  end if;

  select jobs.id, jobs.created_by
  into target_job_id, target_recruiter_id
  from public.jobs
  where jobs.slug = normalized_slug
    and jobs.status = 'published'
    and jobs.published_at is not null
    and (jobs.publish_at is null or jobs.publish_at <= now())
    and (jobs.expires_at is null or jobs.expires_at > now())
  limit 1;

  if target_job_id is null or target_recruiter_id is null then
    raise exception 'job_not_available'
      using errcode = 'P0001';
  end if;

  if target_recruiter_id = current_user_id then
    raise exception 'cannot_apply_to_own_job'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from storage.objects
    where objects.bucket_id = 'application-resumes'
      and objects.name = normalized_resume_path
  ) then
    raise exception 'resume_not_found'
      using errcode = 'P0001';
  end if;

  insert into public.applications (
    job_id,
    candidate_id,
    recruiter_id,
    cover_letter,
    resume_url,
    answers
  )
  values (
    target_job_id,
    current_user_id,
    target_recruiter_id,
    normalized_cover_letter,
    normalized_resume_path,
    normalized_answers
  )
  returning id into inserted_application_id;

  return inserted_application_id;
exception
  when unique_violation then
    raise exception 'already_applied'
      using errcode = '23505';
end;
$$;

revoke all on function public.get_candidate_application_for_job_slug(text)
  from public;
revoke all on function public.get_candidate_application_for_job_slug(text)
  from anon;
revoke all on function public.get_candidate_application_for_job_slug(text)
  from authenticated;
grant execute on function public.get_candidate_application_for_job_slug(text)
  to authenticated;

revoke all on function public.apply_to_published_job(text, text, text, jsonb)
  from public;
revoke all on function public.apply_to_published_job(text, text, text, jsonb)
  from anon;
revoke all on function public.apply_to_published_job(text, text, text, jsonb)
  from authenticated;
grant execute on function public.apply_to_published_job(text, text, text, jsonb)
  to authenticated;

comment on function public.get_candidate_application_for_job_slug(text) is
  'Returns whether the current authenticated candidate already applied to the published job identified by slug without exposing public job UUIDs.';

comment on function public.apply_to_published_job(text, text, text, jsonb) is
  'Owner-safe candidate application RPC. Resolves a public job slug, validates job seeker role, checks private resume storage, prevents own-job applications, and relies on the applications unique constraint for duplicate protection.';

select
  'candidate_apply_flow_verification' as verification,
  to_regclass('public.applications') as applications_table,
  exists (
    select 1
    from storage.buckets
    where buckets.id = 'application-resumes'
  ) as resume_bucket_exists;

commit;
