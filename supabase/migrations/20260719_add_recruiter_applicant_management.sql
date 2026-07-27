begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

create extension if not exists pg_trgm with schema extensions;

create index if not exists applications_recruiter_applied_at_idx
  on public.applications (recruiter_id, applied_at desc, id desc);

create index if not exists applications_recruiter_job_applied_at_idx
  on public.applications (recruiter_id, job_id, applied_at desc, id desc);

create index if not exists applications_recruiter_status_applied_at_idx
  on public.applications (recruiter_id, status, applied_at desc, id desc);

create index if not exists profiles_full_name_trgm_idx
  on public.profiles using gin (full_name gin_trgm_ops);

create index if not exists jobs_title_trgm_idx
  on public.jobs using gin (title gin_trgm_ops);

create or replace function public.get_recruiter_application_management(
  p_search text default '',
  p_status text default null,
  p_job_id uuid default null,
  p_date_from date default null,
  p_date_to date default null,
  p_sort text default 'applied_desc',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  job_id uuid,
  candidate_id uuid,
  status text,
  cover_letter text,
  resume_url text,
  answers jsonb,
  notes text,
  applied_at timestamptz,
  updated_at timestamptz,
  candidate_full_name text,
  candidate_email text,
  candidate_avatar_url text,
  job_title text,
  job_slug text,
  company_name text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with recruiter_profile as (
    select profiles.id
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role_mode = 'recruiter'
      and profiles.profile_completed = true
  ),
  filtered_applications as (
    select
      applications.id,
      applications.job_id,
      applications.candidate_id,
      applications.status,
      applications.cover_letter,
      applications.resume_url,
      applications.answers,
      applications.notes,
      applications.applied_at,
      applications.updated_at,
      candidate_profiles.full_name as candidate_full_name,
      candidate_profiles.email as candidate_email,
      candidate_profiles.avatar_url as candidate_avatar_url,
      jobs.title as job_title,
      jobs.slug as job_slug,
      jobs.company_name,
      count(*) over () as total_count
    from public.applications
    inner join public.jobs
      on jobs.id = applications.job_id
    inner join public.profiles as candidate_profiles
      on candidate_profiles.id = applications.candidate_id
    where exists (select 1 from recruiter_profile)
      and applications.recruiter_id = auth.uid()
      and jobs.created_by = auth.uid()
      and (
        p_status is null
        or p_status = ''
        or applications.status = p_status
      )
      and (
        p_job_id is null
        or applications.job_id = p_job_id
      )
      and (
        p_date_from is null
        or applications.applied_at >= p_date_from::timestamptz
      )
      and (
        p_date_to is null
        or applications.applied_at < (p_date_to + 1)::timestamptz
      )
      and (
        trim(coalesce(p_search, '')) = ''
        or candidate_profiles.full_name ilike '%' || trim(p_search) || '%'
        or candidate_profiles.email ilike '%' || trim(p_search) || '%'
        or jobs.title ilike '%' || trim(p_search) || '%'
      )
  )
  select
    filtered_applications.id,
    filtered_applications.job_id,
    filtered_applications.candidate_id,
    filtered_applications.status,
    filtered_applications.cover_letter,
    filtered_applications.resume_url,
    filtered_applications.answers,
    filtered_applications.notes,
    filtered_applications.applied_at,
    filtered_applications.updated_at,
    filtered_applications.candidate_full_name,
    filtered_applications.candidate_email,
    filtered_applications.candidate_avatar_url,
    filtered_applications.job_title,
    filtered_applications.job_slug,
    filtered_applications.company_name,
    filtered_applications.total_count
  from filtered_applications
  order by
    case when p_sort = 'applied_asc' then filtered_applications.applied_at end asc nulls last,
    case when p_sort = 'candidate_asc' then lower(coalesce(filtered_applications.candidate_full_name, filtered_applications.candidate_email, '')) end asc,
    case when p_sort = 'job_asc' then lower(coalesce(filtered_applications.job_title, '')) end asc,
    case when p_sort = 'status_asc' then filtered_applications.status end asc,
    filtered_applications.applied_at desc,
    filtered_applications.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.update_recruiter_application_status(
  p_application_id uuid,
  p_status text
)
returns table (
  id uuid,
  status text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.applications
  set
    status = p_status,
    updated_at = now()
  from public.jobs
  where applications.id = p_application_id
    and jobs.id = applications.job_id
    and applications.recruiter_id = auth.uid()
    and jobs.created_by = auth.uid()
    and p_status in (
      'applied',
      'reviewing',
      'shortlisted',
      'interview',
      'offered',
      'hired',
      'rejected',
      'withdrawn'
    )
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    )
  returning
    applications.id,
    applications.status,
    applications.updated_at;
$$;

revoke all on function public.get_recruiter_application_management(
  text,
  text,
  uuid,
  date,
  date,
  text,
  integer,
  integer
) from public;
revoke all on function public.get_recruiter_application_management(
  text,
  text,
  uuid,
  date,
  date,
  text,
  integer,
  integer
) from anon;
revoke all on function public.get_recruiter_application_management(
  text,
  text,
  uuid,
  date,
  date,
  text,
  integer,
  integer
) from authenticated;
grant execute on function public.get_recruiter_application_management(
  text,
  text,
  uuid,
  date,
  date,
  text,
  integer,
  integer
) to authenticated;

revoke all on function public.update_recruiter_application_status(uuid, text)
  from public;
revoke all on function public.update_recruiter_application_status(uuid, text)
  from anon;
revoke all on function public.update_recruiter_application_status(uuid, text)
  from authenticated;
grant execute on function public.update_recruiter_application_status(uuid, text)
  to authenticated;

comment on function public.get_recruiter_application_management(
  text,
  text,
  uuid,
  date,
  date,
  text,
  integer,
  integer
) is
  'Recruiter-only applicant management reader. Returns applications, candidate summary, job summary, private notes, filters, sorting, and total count for jobs owned by auth.uid().';

comment on function public.update_recruiter_application_status(uuid, text) is
  'Recruiter-only application status updater for applications on jobs owned by auth.uid().';

select
  'recruiter_applicant_management_verification' as verification,
  to_regprocedure(
    'public.get_recruiter_application_management(text,text,uuid,date,date,text,integer,integer)'
  ) as management_rpc,
  to_regprocedure(
    'public.update_recruiter_application_status(uuid,text)'
  ) as status_rpc;

commit;
