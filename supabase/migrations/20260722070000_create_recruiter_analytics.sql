begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

create or replace function public.get_recruiter_analytics(
  p_date_from date default null,
  p_date_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  range_from date := coalesce(
    p_date_from,
    (now() at time zone 'utc')::date - 29
  );
  range_to date := coalesce(
    p_date_to,
    (now() at time zone 'utc')::date
  );
  result jsonb;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles as recruiter_profile
    where recruiter_profile.id = actor_id
      and recruiter_profile.role_mode = 'recruiter'
      and recruiter_profile.profile_completed = true
  ) then
    raise exception 'recruiter_required' using errcode = '42501';
  end if;

  if range_from > range_to or range_to - range_from > 365 then
    raise exception 'analytics_date_range_invalid' using errcode = '22023';
  end if;

  with owned_jobs as (
    select
      job_rows.id,
      job_rows.title,
      job_rows.status,
      job_rows.created_at,
      job_rows.updated_at,
      job_rows.published_at,
      job_rows.views_count,
      job_rows.moderation_status,
      job_rows.publish_at,
      job_rows.expires_at
    from public.jobs as job_rows
    where job_rows.created_by = actor_id
  ),
  owned_applications as (
    select
      application_rows.id,
      application_rows.job_id,
      application_rows.status,
      application_rows.applied_at,
      application_rows.updated_at,
      application_rows.hired_at,
      application_rows.source
    from public.applications as application_rows
    inner join owned_jobs
      on owned_jobs.id = application_rows.job_id
    where application_rows.recruiter_id = actor_id
  ),
  owned_interviews as (
    select
      interview_rows.id,
      interview_rows.application_id,
      interview_rows.status,
      interview_rows.scheduled_start,
      interview_rows.created_at
    from public.interviews as interview_rows
    inner join owned_applications
      on owned_applications.id = interview_rows.application_id
    where interview_rows.recruiter_id = actor_id
  ),
  job_performance as (
    select
      owned_jobs.id,
      owned_jobs.title,
      owned_jobs.status,
      owned_jobs.created_at,
      owned_jobs.updated_at,
      owned_jobs.published_at,
      coalesce(owned_jobs.views_count, 0) as views_count,
      count(owned_applications.id)::bigint as applications_count
    from owned_jobs
    left join owned_applications
      on owned_applications.job_id = owned_jobs.id
    group by
      owned_jobs.id,
      owned_jobs.title,
      owned_jobs.status,
      owned_jobs.created_at,
      owned_jobs.updated_at,
      owned_jobs.published_at,
      owned_jobs.views_count
  ),
  trend_days as (
    select generate_series(
      range_from::timestamptz,
      range_to::timestamptz,
      interval '1 day'
    )::date as metric_date
  ),
  trend_rows as (
    select
      trend_days.metric_date,
      (
        select count(*)::integer from owned_applications
        where owned_applications.applied_at >= trend_days.metric_date
          and owned_applications.applied_at < trend_days.metric_date + 1
      ) as applications,
      (
        select count(*)::integer from owned_interviews
        where owned_interviews.scheduled_start >= trend_days.metric_date
          and owned_interviews.scheduled_start < trend_days.metric_date + 1
          and owned_interviews.status in ('scheduled', 'completed', 'no_show')
      ) as interviews,
      (
        select count(*)::integer from owned_applications
        where owned_applications.status = 'hired'
          and coalesce(owned_applications.hired_at, owned_applications.updated_at) >= trend_days.metric_date
          and coalesce(owned_applications.hired_at, owned_applications.updated_at) < trend_days.metric_date + 1
      ) as hires,
      coalesce((
        select sum(metrics.views_count)::integer
        from public.job_daily_metrics as metrics
        inner join owned_jobs as metric_jobs
          on metric_jobs.id = metrics.job_id
        where metrics.metric_date = trend_days.metric_date
      ), 0) as views
    from trend_days
  ),
  source_rows as (
    select
      case
        when lower(trim(owned_applications.source)) = 'linkedin' then 'LinkedIn'
        when lower(trim(owned_applications.source)) in ('direct', 'referral', 'website')
          then initcap(lower(trim(owned_applications.source)))
        else 'Other'
      end as source_label,
      count(*)::integer as source_count
    from owned_applications
    where nullif(trim(coalesce(owned_applications.source, '')), '') is not null
      and owned_applications.applied_at >= range_from::timestamptz
      and owned_applications.applied_at < (range_to + 1)::timestamptz
    group by 1
  ),
  activity_rows as (
    select
      'job_posted:' || owned_jobs.id::text as activity_id,
      'job_posted' as activity_type,
      'Job posted' as activity_title,
      coalesce(nullif(trim(owned_jobs.title), ''), 'Untitled role') as activity_description,
      owned_jobs.created_at as activity_created_at
    from owned_jobs
    where owned_jobs.created_at >= range_from::timestamptz
      and owned_jobs.created_at < (range_to + 1)::timestamptz
    union all
    select
      'application_received:' || owned_applications.id::text,
      'application_received',
      'Application received',
      'Application received for ' || coalesce(nullif(trim(owned_jobs.title), ''), 'an untitled role'),
      owned_applications.applied_at
    from owned_applications
    inner join owned_jobs on owned_jobs.id = owned_applications.job_id
    where owned_applications.applied_at >= range_from::timestamptz
      and owned_applications.applied_at < (range_to + 1)::timestamptz
    union all
    select
      'application_status:' || status_history.id::text,
      'application_status',
      'Application status updated',
      'Application for ' || coalesce(nullif(trim(owned_jobs.title), ''), 'an untitled role')
        || ' moved to ' || initcap(replace(status_history.new_status, '_', ' ')),
      status_history.created_at
    from public.application_status_history as status_history
    inner join owned_applications
      on owned_applications.id = status_history.application_id
    inner join owned_jobs
      on owned_jobs.id = owned_applications.job_id
    where status_history.created_at >= range_from::timestamptz
      and status_history.created_at < (range_to + 1)::timestamptz
    union all
    select
      'interview_event:' || interview_events.id::text,
      'interview_' || interview_events.event_type,
      'Interview ' || replace(interview_events.event_type, '_', ' '),
      'Interview activity for ' || coalesce(nullif(trim(owned_jobs.title), ''), 'an untitled role'),
      interview_events.created_at
    from public.interview_events
    inner join owned_interviews
      on owned_interviews.id = interview_events.interview_id
    inner join owned_applications
      on owned_applications.id = owned_interviews.application_id
    inner join owned_jobs
      on owned_jobs.id = owned_applications.job_id
    where interview_events.created_at >= range_from::timestamptz
      and interview_events.created_at < (range_to + 1)::timestamptz
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'activeJobs', (
        select count(*) from owned_jobs
        where status = 'published'
          and coalesce(moderation_status, 'active') = 'active'
          and (publish_at is null or publish_at <= now())
          and (expires_at is null or expires_at > now())
      ),
      'draftJobs', (select count(*) from owned_jobs where status = 'draft'),
      'closedJobs', (select count(*) from owned_jobs where status = 'closed'),
      'totalApplications', (select count(*) from owned_applications),
      'newApplicationsLast7Days', (
        select count(*) from owned_applications
        where applied_at >= (now() at time zone 'utc')::date - 6
          and applied_at < (now() at time zone 'utc')::date + 1
      ),
      'interviewsScheduled', (select count(*) from owned_interviews where status = 'scheduled'),
      'interviewsCompleted', (select count(*) from owned_interviews where status = 'completed'),
      'hires', (select count(*) from owned_applications where status = 'hired'),
      'rejections', (select count(*) from owned_applications where status = 'rejected'),
      'offersSent', (select count(*) from owned_applications where status = 'offered'),
      'totalJobViews', (select coalesce(sum(views_count), 0) from owned_jobs),
      'averageApplicationsPerJob', (
        select coalesce(round(avg(applications_count)::numeric, 1), 0) from job_performance
      ),
      'conversionRate', (
        select case
          when coalesce(sum(views_count), 0) = 0 then 0
          else round((sum(applications_count)::numeric / sum(views_count)::numeric) * 100, 1)
        end
        from job_performance
      )
    ),
    'jobStatusCounts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'status', status_rows.job_status,
          'value', status_rows.status_count
        ) order by status_rows.sort_order
      )
      from (
        select
          normalized_jobs.job_status,
          count(*)::integer as status_count,
          min(normalized_jobs.sort_order) as sort_order
        from (
          select
            case
              when owned_jobs.status = 'published'
                and owned_jobs.publish_at is not null
                and owned_jobs.publish_at > now()
                then 'scheduled'
              else owned_jobs.status
            end as job_status,
            case
              when owned_jobs.status = 'published'
                and owned_jobs.publish_at is not null
                and owned_jobs.publish_at > now()
                then 2
              when owned_jobs.status = 'published' then 1
              when owned_jobs.status = 'pending' then 3
              when owned_jobs.status = 'draft' then 4
              when owned_jobs.status = 'closed' then 5
              when owned_jobs.status = 'archived' then 6
              else 7
            end as sort_order
          from owned_jobs
        ) as normalized_jobs
        group by normalized_jobs.job_status
      ) as status_rows
    ), '[]'::jsonb),
    'funnel', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', 'funnel-' || funnel_order.status,
          'status', funnel_order.status,
          'label', initcap(replace(funnel_order.status, '_', ' ')),
          'value', coalesce(status_counts.status_count, 0)
        ) order by funnel_order.sort_order
      )
      from (
        values
          ('applied', 1),
          ('reviewing', 2),
          ('shortlisted', 3),
          ('interview', 4),
          ('offered', 5),
          ('hired', 6)
      ) as funnel_order(status, sort_order)
      left join (
        select status, count(*)::integer as status_count
        from owned_applications
        group by status
      ) as status_counts on status_counts.status = funnel_order.status
    ), '[]'::jsonb),
    'trend', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', trend_rows.metric_date,
          'label', to_char(trend_rows.metric_date, 'DD Mon'),
          'applications', trend_rows.applications,
          'interviews', trend_rows.interviews,
          'hires', trend_rows.hires,
          'views', trend_rows.views
        ) order by trend_rows.metric_date
      ) from trend_rows
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(
        jsonb_build_object('label', source_rows.source_label, 'value', source_rows.source_count)
        order by source_rows.source_count desc, source_rows.source_label asc
      ) from source_rows
    ), '[]'::jsonb),
    'jobPerformance', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', job_performance.id,
          'title', coalesce(nullif(trim(job_performance.title), ''), 'Untitled role'),
          'status', job_performance.status,
          'viewsCount', job_performance.views_count,
          'applicationsCount', job_performance.applications_count,
          'createdAt', job_performance.created_at,
          'publishedAt', job_performance.published_at,
          'updatedAt', job_performance.updated_at,
          'conversionRate', case
            when job_performance.views_count = 0 then 0
            else round((job_performance.applications_count::numeric / job_performance.views_count::numeric) * 100, 1)
          end
        ) order by job_performance.applications_count desc, job_performance.created_at desc
      ) from (
        select *
        from job_performance
        order by applications_count desc, created_at desc
        limit 100
      ) as job_performance
    ), '[]'::jsonb),
    'recentActivity', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', activity_rows.activity_id,
          'type', activity_rows.activity_type,
          'title', activity_rows.activity_title,
          'description', activity_rows.activity_description,
          'createdAt', activity_rows.activity_created_at
        ) order by activity_rows.activity_created_at desc
      ) from (select * from activity_rows order by activity_created_at desc limit 12) as activity_rows
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_recruiter_analytics(date, date) from public, anon;
grant execute on function public.get_recruiter_analytics(date, date) to authenticated;

comment on function public.get_recruiter_analytics(date, date) is
  'Returns aggregate recruiter-owned analytics for a bounded UTC date range. Ownership is derived from auth.uid().';

commit;

notify pgrst, 'reload schema';
