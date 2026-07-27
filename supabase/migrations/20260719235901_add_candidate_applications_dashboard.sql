begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

create or replace function public.get_candidate_applications_dashboard(
  p_search text default '',
  p_status text default null,
  p_company text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  id uuid,
  status text,
  applied_at timestamptz,
  updated_at timestamptz,
  job_slug text,
  job_title text,
  company_name text,
  location text,
  employment_type text,
  workplace_type text,
  experience_level text,
  category text,
  description text,
  requirements text,
  benefits text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  salary_visible boolean,
  application_url text,
  application_email text,
  resume_submitted boolean,
  cover_letter text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with candidate_profile as (
    select profiles.id
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role_mode = 'job_seeker'
      and profiles.profile_completed = true
  ),
  filtered_applications as (
    select
      applications.id,
      applications.status,
      applications.applied_at,
      applications.updated_at,
      jobs.slug as job_slug,
      jobs.title as job_title,
      jobs.company_name,
      jobs.location,
      jobs.employment_type,
      jobs.workplace_type,
      jobs.experience_level,
      jobs.category,
      jobs.description,
      jobs.requirements,
      jobs.benefits,
      jobs.salary_min,
      jobs.salary_max,
      jobs.salary_currency,
      jobs.salary_visible,
      jobs.application_url,
      jobs.application_email,
      (applications.resume_url is not null and trim(applications.resume_url) <> '')
        as resume_submitted,
      applications.cover_letter,
      count(*) over () as total_count
    from public.applications
    inner join public.jobs on jobs.id = applications.job_id
    where exists (select 1 from candidate_profile)
      and applications.candidate_id = auth.uid()
      and (
        p_status is null
        or p_status = ''
        or applications.status = p_status
      )
      and (
        p_company is null
        or trim(p_company) = ''
        or jobs.company_name ilike '%' || trim(p_company) || '%'
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
        or jobs.title ilike '%' || trim(p_search) || '%'
        or jobs.company_name ilike '%' || trim(p_search) || '%'
      )
  )
  select
    filtered_applications.id,
    filtered_applications.status,
    filtered_applications.applied_at,
    filtered_applications.updated_at,
    filtered_applications.job_slug,
    filtered_applications.job_title,
    filtered_applications.company_name,
    filtered_applications.location,
    filtered_applications.employment_type,
    filtered_applications.workplace_type,
    filtered_applications.experience_level,
    filtered_applications.category,
    filtered_applications.description,
    filtered_applications.requirements,
    filtered_applications.benefits,
    filtered_applications.salary_min,
    filtered_applications.salary_max,
    filtered_applications.salary_currency,
    filtered_applications.salary_visible,
    filtered_applications.application_url,
    filtered_applications.application_email,
    filtered_applications.resume_submitted,
    filtered_applications.cover_letter,
    filtered_applications.total_count
  from filtered_applications
  order by filtered_applications.applied_at desc nulls last,
    filtered_applications.id desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_candidate_applications_dashboard(
  text,
  text,
  text,
  date,
  date,
  integer,
  integer
) from public, anon, authenticated;
grant execute on function public.get_candidate_applications_dashboard(
  text,
  text,
  text,
  date,
  date,
  integer,
  integer
) to authenticated;

comment on function public.get_candidate_applications_dashboard(
  text,
  text,
  text,
  date,
  date,
  integer,
  integer
) is
  'Candidate-owned, paginated application dashboard reader. Returns only the authenticated job seeker''s application and job details.';

notify pgrst, 'reload schema';

commit;
