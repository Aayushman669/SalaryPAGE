begin;

set local search_path = public, storage, extensions, pg_catalog, pg_temp;

-- The recruiter-management migration created two indexes already covered by
-- the foundation indexes. Remove only the redundant indexes; no data is lost.
drop index if exists public.applications_recruiter_applied_at_idx;
drop index if exists public.applications_recruiter_status_applied_at_idx;

-- Applications store private Storage object paths, not public URLs. Preserve
-- legacy HTTPS values while accepting only the path shape created by the app.
alter table public.applications
  drop constraint if exists applications_resume_url_check;

alter table public.applications
  add constraint applications_resume_url_check
  check (
    resume_url is null
    or resume_url ~* '^https?://'
    or resume_url ~* '^[0-9a-f-]{36}/[a-z0-9-]+/[a-z0-9-]+\.pdf$'
  );

drop policy if exists "Candidates can upload their own application resumes"
  on storage.objects;

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
    )
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
    and not exists (
      select 1
      from public.applications
      where applications.resume_url = storage.objects.name
    )
  );

create or replace function public.apply_to_published_job(
  p_job_slug text,
  p_resume_path text,
  p_cover_letter text default '',
  p_answers jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, storage, extensions, pg_catalog, pg_temp
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

  if normalized_resume_path !~* (
    '^' || current_user_id::text || '/[a-z0-9-]+/[a-z0-9-]+\.pdf$'
  ) then
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

revoke all on function public.apply_to_published_job(text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_to_published_job(text, text, text, jsonb)
  to authenticated;

comment on constraint applications_resume_url_check on public.applications is
  'Accepts legacy HTTPS resume references and private application-resumes object paths only.';

notify pgrst, 'reload schema';

commit;
