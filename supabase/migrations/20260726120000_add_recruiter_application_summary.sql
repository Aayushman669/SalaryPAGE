create or replace function public.get_recruiter_application_summary()
returns table (
  total_applicants bigint,
  new_applicants bigint,
  shortlisted bigint,
  interviews_scheduled bigint
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    count(distinct application_rows.id),
    count(distinct application_rows.id)
      filter (where application_rows.status = 'applied'),
    count(distinct application_rows.id)
      filter (where application_rows.status = 'shortlisted'),
    count(distinct interview_rows.application_id)
      filter (where interview_rows.status = 'scheduled')
  from public.applications as application_rows
  inner join public.jobs as job_rows
    on job_rows.id = application_rows.job_id
  inner join public.profiles as recruiter_profile
    on recruiter_profile.id = auth.uid()
  left join public.interviews as interview_rows
    on interview_rows.application_id = application_rows.id
    and interview_rows.recruiter_id = auth.uid()
  where recruiter_profile.role_mode = 'recruiter'
    and recruiter_profile.profile_completed = true
    and application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid();
$$;

revoke all on function public.get_recruiter_application_summary()
  from public, anon, authenticated;
grant execute on function public.get_recruiter_application_summary()
  to authenticated;

comment on function public.get_recruiter_application_summary() is
  'Returns recruiter-owned application summary counts without accepting client ownership values.';
