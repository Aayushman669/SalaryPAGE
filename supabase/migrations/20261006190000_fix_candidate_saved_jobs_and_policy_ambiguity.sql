begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

drop policy if exists "Candidates can create their own applications"
  on public.applications;

create policy "Candidates can create their own applications"
  on public.applications
  for insert
  to authenticated
  with check (
    applications.candidate_id = auth.uid()
    and applications.status = 'applied'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'job_seeker'
        and profiles.profile_completed = true
        and profiles.moderation_status = 'active'
    )
  );

drop policy if exists "Candidates can read their own applications"
  on public.applications;

create policy "Candidates can read their own applications"
  on public.applications
  for select
  to authenticated
  using (applications.candidate_id = auth.uid());

drop policy if exists "Candidates can withdraw their own applications"
  on public.applications;

create policy "Candidates can withdraw their own applications"
  on public.applications
  for update
  to authenticated
  using (
    applications.candidate_id = auth.uid()
    and applications.status <> 'withdrawn'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.moderation_status = 'active'
    )
  )
  with check (
    applications.candidate_id = auth.uid()
    and applications.status = 'withdrawn'
  );

drop policy if exists "Candidates can read their own saved jobs"
  on public.saved_jobs;

create policy "Candidates can read their own saved jobs"
  on public.saved_jobs
  for select
  to authenticated
  using (
    saved_jobs.candidate_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'job_seeker'
        and profiles.moderation_status = 'active'
    )
  );

create or replace function public.get_candidate_saved_jobs(
  p_search text default '',
  p_employment_type text default null,
  p_workplace_type text default null,
  p_location text default '',
  p_sort text default 'recent',
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  job_slug text,
  job_title text,
  company_name text,
  location text,
  employment_type text,
  workplace_type text,
  experience_level text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  salary_visible boolean,
  featured boolean,
  posted_at timestamptz,
  saved_at timestamptz,
  availability_status text,
  has_applied boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := public.assert_saved_jobs_candidate();
  normalized_search text := trim(regexp_replace(coalesce(p_search, ''), '\s+', ' ', 'g'));
  normalized_location text := trim(regexp_replace(coalesce(p_location, ''), '\s+', ' ', 'g'));
  normalized_sort text := lower(trim(coalesce(p_sort, 'recent')));
  safe_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if normalized_sort not in ('recent', 'oldest', 'newest_job', 'oldest_job') then
    normalized_sort := 'recent';
  end if;

  return query
  with saved_rows as (
    select
      jobs.slug::text as raw_slug,
      jobs.title::text as raw_title,
      jobs.company_name::text as raw_company_name,
      jobs.location::text as raw_location,
      jobs.employment_type::text as raw_employment_type,
      jobs.workplace_type::text as raw_workplace_type,
      jobs.experience_level::text as raw_experience_level,
      jobs.salary_min as raw_salary_min,
      jobs.salary_max as raw_salary_max,
      jobs.salary_currency::text as raw_salary_currency,
      jobs.salary_visible as raw_salary_visible,
      jobs.featured as raw_featured,
      coalesce(jobs.published_at, jobs.created_at) as raw_posted_at,
      saved_jobs.created_at as raw_saved_at,
      (
        jobs.status = 'published'
        and jobs.moderation_status = 'active'
        and jobs.published_at is not null
        and (jobs.publish_at is null or jobs.publish_at <= now())
        and (jobs.expires_at is null or jobs.expires_at > now())
        and (
          jobs.company_id is null
          or exists (
            select 1
            from public.companies
            where companies.id = jobs.company_id
              and companies.moderation_status = 'active'
          )
        )
      ) as is_available,
      exists (
        select 1
        from public.applications
        where applications.job_id = jobs.id
          and applications.candidate_id = actor_id
      ) as raw_has_applied
    from public.saved_jobs
    inner join public.jobs
      on jobs.id = saved_jobs.job_id
    where saved_jobs.candidate_id = actor_id
      and (
        normalized_search = ''
        or jobs.title ilike '%' || normalized_search || '%'
        or jobs.company_name ilike '%' || normalized_search || '%'
        or jobs.location ilike '%' || normalized_search || '%'
      )
      and (coalesce(p_employment_type, '') = '' or jobs.employment_type::text = p_employment_type)
      and (coalesce(p_workplace_type, '') = '' or jobs.workplace_type::text = p_workplace_type)
      and (
        normalized_location = ''
        or jobs.location ilike '%' || normalized_location || '%'
      )
  )
  select
    saved_rows.raw_slug,
    (case when saved_rows.is_available then coalesce(nullif(trim(saved_rows.raw_title), ''), 'Untitled role') else 'This job is no longer available.' end)::text,
    (case when saved_rows.is_available then coalesce(nullif(trim(saved_rows.raw_company_name), ''), 'Company') else 'Company unavailable' end)::text,
    (case when saved_rows.is_available then coalesce(nullif(trim(saved_rows.raw_location), ''), 'Location not specified') else null end)::text,
    (case when saved_rows.is_available then saved_rows.raw_employment_type else null end)::text,
    (case when saved_rows.is_available then saved_rows.raw_workplace_type else null end)::text,
    (case when saved_rows.is_available then saved_rows.raw_experience_level else null end)::text,
    case when saved_rows.is_available and coalesce(saved_rows.raw_salary_visible, true) then saved_rows.raw_salary_min else null end,
    case when saved_rows.is_available and coalesce(saved_rows.raw_salary_visible, true) then saved_rows.raw_salary_max else null end,
    (case when saved_rows.is_available and coalesce(saved_rows.raw_salary_visible, true) then saved_rows.raw_salary_currency else null end)::text,
    case when saved_rows.is_available then coalesce(saved_rows.raw_salary_visible, true) else false end,
    case when saved_rows.is_available then coalesce(saved_rows.raw_featured, false) else false end,
    case when saved_rows.is_available then saved_rows.raw_posted_at else null end,
    saved_rows.raw_saved_at,
    (case when saved_rows.is_available then 'available' else 'unavailable' end)::text,
    case when saved_rows.is_available then saved_rows.raw_has_applied else false end,
    count(*) over ()
  from saved_rows
  order by
    case when normalized_sort = 'recent' then saved_rows.raw_saved_at end desc,
    case when normalized_sort = 'oldest' then saved_rows.raw_saved_at end asc,
    case when normalized_sort = 'newest_job' then saved_rows.raw_posted_at end desc nulls last,
    case when normalized_sort = 'oldest_job' then saved_rows.raw_posted_at end asc nulls last,
    saved_rows.raw_saved_at desc
  limit safe_limit
  offset safe_offset;
end;
$$;

revoke all on function public.get_candidate_saved_jobs(text, text, text, text, text, integer, integer)
  from public, anon;
grant execute on function public.get_candidate_saved_jobs(text, text, text, text, text, integer, integer)
  to authenticated;

notify pgrst, 'reload schema';

commit;
