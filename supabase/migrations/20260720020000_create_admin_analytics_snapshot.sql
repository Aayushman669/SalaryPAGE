begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- This function is intentionally callable only by the server-side service role.
-- The Admin API authenticates the requesting user and checks app_metadata.role
-- before invoking it, while browser clients never receive the service key.
create or replace function public.get_admin_analytics_snapshot(
  p_range text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_range text;
  v_selected_start timestamptz;
  v_today_start timestamptz := date_trunc('day', now());
  v_week_start timestamptz := date_trunc('week', now());
  v_month_start timestamptz := date_trunc('month', now());
begin
  v_range := case p_range
    when 'today' then 'today'
    when '7d' then '7d'
    when '30d' then '30d'
    when '90d' then '90d'
    else 'all'
  end;

  v_selected_start := case v_range
    when 'today' then v_today_start
    when '7d' then now() - interval '7 days'
    when '30d' then now() - interval '30 days'
    when '90d' then now() - interval '90 days'
    else 'epoch'::timestamptz
  end;

  return jsonb_build_object(
    'range', v_range,
    'counts', jsonb_build_object(
      'users', (select count(*)::integer from public.profiles),
      'candidates', (select count(*)::integer from public.profiles where role_mode = 'job_seeker'),
      'recruiters', (select count(*)::integer from public.profiles where role_mode = 'recruiter'),
      'companies', (select count(*)::integer from public.companies),
      'jobs', (select count(*)::integer from public.jobs),
      'activeJobs', (select count(*)::integer from public.jobs where status = 'published'),
      'draftJobs', (select count(*)::integer from public.jobs where status = 'draft'),
      'applications', (select count(*)::integer from public.applications),
      'successfulPayments', (select count(*)::integer from public.purchase_history where status in ('paid', 'captured')),
      'totalRevenue', (select coalesce(sum(amount), 0)::numeric from public.purchase_history where status in ('paid', 'captured')),
      'activePaidUsers', (
        select count(distinct subscriptions.recruiter_id)::integer
        from public.subscriptions
        inner join public.plans on plans.id = subscriptions.plan_id
        where subscriptions.status in ('active', 'lifetime')
          and plans.slug <> 'free'
          and (subscriptions.expires_at is null or subscriptions.expires_at > now())
      )
    ),
    'growth', jsonb_build_object(
      'newUsersToday', (select count(*)::integer from public.profiles where created_at >= v_today_start),
      'newUsersThisWeek', (select count(*)::integer from public.profiles where created_at >= v_week_start),
      'newUsersThisMonth', (select count(*)::integer from public.profiles where created_at >= v_month_start),
      'newUsersSelected', (select count(*)::integer from public.profiles where created_at >= v_selected_start),
      'newJobsSelected', (select count(*)::integer from public.jobs where created_at >= v_selected_start),
      'newApplicationsSelected', (select count(*)::integer from public.applications where applied_at >= v_selected_start),
      'newCompaniesSelected', (select count(*)::integer from public.companies where created_at >= v_selected_start)
    ),
    'revenue', jsonb_build_object(
      'selected', (select coalesce(sum(amount), 0)::numeric from public.purchase_history where status in ('paid', 'captured') and purchased_at >= v_selected_start),
      'today', (select coalesce(sum(amount), 0)::numeric from public.purchase_history where status in ('paid', 'captured') and purchased_at >= v_today_start),
      'thisWeek', (select coalesce(sum(amount), 0)::numeric from public.purchase_history where status in ('paid', 'captured') and purchased_at >= v_week_start),
      'thisMonth', (select coalesce(sum(amount), 0)::numeric from public.purchase_history where status in ('paid', 'captured') and purchased_at >= v_month_start),
      'byPlan', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'slug', plan_totals.slug,
          'name', plan_totals.name,
          'revenue', plan_totals.revenue
        ) order by plan_totals.display_order), '[]'::jsonb)
        from (
          select
            plans.slug,
            plans.name,
            plans.display_order,
            coalesce(sum(purchase_history.amount), 0)::numeric as revenue
          from public.plans
          left join public.purchase_history
            on purchase_history.plan_id = plans.id
            and purchase_history.status in ('paid', 'captured')
            and purchase_history.purchased_at >= v_selected_start
          where plans.slug in ('starter', 'growth', 'pro')
          group by plans.slug, plans.name, plans.display_order
        ) as plan_totals
      )
    ),
    'planDistribution', (
      select coalesce(jsonb_object_agg(distribution.slug, distribution.user_count), '{}'::jsonb)
      from (
        select
          plans.slug,
          count(distinct subscriptions.recruiter_id)::integer as user_count
        from public.plans
        left join public.subscriptions
          on subscriptions.plan_id = plans.id
          and subscriptions.status in ('active', 'lifetime')
          and (subscriptions.expires_at is null or subscriptions.expires_at > now())
        where plans.slug in ('starter', 'growth', 'pro')
        group by plans.slug
      ) as distribution
    ),
    'topCompanies', jsonb_build_object(
      'mostJobs', (
        select coalesce(jsonb_agg(jsonb_build_object('id', ranked.id, 'name', ranked.name, 'value', ranked.value) order by ranked.value desc, ranked.name), '[]'::jsonb)
        from (
          select companies.id, companies.name, count(jobs.id)::integer as value
          from public.companies
          left join public.jobs on jobs.company_id = companies.id and jobs.created_at >= v_selected_start
          group by companies.id, companies.name
          having count(jobs.id) > 0
          order by value desc, companies.name
          limit 5
        ) as ranked
      ),
      'mostApplications', (
        select coalesce(jsonb_agg(jsonb_build_object('id', ranked.id, 'name', ranked.name, 'value', ranked.value) order by ranked.value desc, ranked.name), '[]'::jsonb)
        from (
          select companies.id, companies.name, count(applications.id)::integer as value
          from public.companies
          inner join public.jobs on jobs.company_id = companies.id
          inner join public.applications on applications.job_id = jobs.id and applications.applied_at >= v_selected_start
          group by companies.id, companies.name
          having count(applications.id) > 0
          order by value desc, companies.name
          limit 5
        ) as ranked
      ),
      'highestHiringActivity', (
        select coalesce(jsonb_agg(jsonb_build_object('id', ranked.id, 'name', ranked.name, 'value', ranked.value) order by ranked.value desc, ranked.name), '[]'::jsonb)
        from (
          select companies.id, companies.name, count(applications.id)::integer as value
          from public.companies
          inner join public.jobs on jobs.company_id = companies.id
          inner join public.applications on applications.job_id = jobs.id
            and applications.applied_at >= v_selected_start
            and applications.status in ('shortlisted', 'interview', 'offered', 'hired')
          group by companies.id, companies.name
          having count(applications.id) > 0
          order by value desc, companies.name
          limit 5
        ) as ranked
      )
    ),
    'topRecruiters', jsonb_build_object(
      'jobsPosted', (
        select coalesce(jsonb_agg(jsonb_build_object('id', ranked.id, 'name', ranked.name, 'value', ranked.value) order by ranked.value desc, ranked.name), '[]'::jsonb)
        from (
          select profiles.id, coalesce(nullif(trim(profiles.full_name), ''), 'Unnamed recruiter') as name, count(jobs.id)::integer as value
          from public.profiles
          inner join public.jobs on jobs.created_by = profiles.id and jobs.created_at >= v_selected_start
          where profiles.role_mode = 'recruiter'
          group by profiles.id, profiles.full_name
          order by value desc, name
          limit 5
        ) as ranked
      ),
      'applicationsReceived', (
        select coalesce(jsonb_agg(jsonb_build_object('id', ranked.id, 'name', ranked.name, 'value', ranked.value) order by ranked.value desc, ranked.name), '[]'::jsonb)
        from (
          select profiles.id, coalesce(nullif(trim(profiles.full_name), ''), 'Unnamed recruiter') as name, count(applications.id)::integer as value
          from public.profiles
          inner join public.jobs on jobs.created_by = profiles.id
          inner join public.applications on applications.job_id = jobs.id and applications.applied_at >= v_selected_start
          where profiles.role_mode = 'recruiter'
          group by profiles.id, profiles.full_name
          order by value desc, name
          limit 5
        ) as ranked
      )
    )
  );
end;
$$;

revoke all on function public.get_admin_analytics_snapshot(text) from public, anon, authenticated;
grant execute on function public.get_admin_analytics_snapshot(text) to service_role;

comment on function public.get_admin_analytics_snapshot(text) is
  'Server-only aggregate analytics snapshot for the authenticated admin panel. The Admin API checks the caller before invoking this service-role-only function.';

notify pgrst, 'reload schema';

commit;
