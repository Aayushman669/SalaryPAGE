begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

drop function if exists public.get_my_subscription_snapshot();

create function public.get_my_subscription_snapshot()
returns table (
  role_mode text,
  plan_id uuid,
  plan_slug text,
  plan_name text,
  plan_description text,
  plan_price numeric,
  plan_currency char(3),
  billing_type text,
  duration_days integer,
  job_post_limit integer,
  featured_job_limit integer,
  priority_support boolean,
  resume_database_access boolean,
  subscription_id uuid,
  subscription_status text,
  subscription_starts_at timestamptz,
  subscription_expires_at timestamptz,
  subscription_purchased_at timestamptz,
  jobs_posted integer,
  featured_jobs_used integer,
  remaining_jobs integer,
  usage_period_start timestamptz,
  usage_period_end timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with current_profile as (
    select profiles.id, profiles.role_mode
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role_mode = 'recruiter'
      and profiles.profile_completed = true
  ),
  current_subscription as (
    select
      subscriptions.id,
      subscriptions.plan_id,
      case
        when subscriptions.status = 'active'
          and subscriptions.expires_at is not null
          and subscriptions.expires_at <= now()
          then 'expired'
        else subscriptions.status
      end as status,
      subscriptions.starts_at,
      subscriptions.expires_at,
      subscriptions.purchased_at
    from public.subscriptions
    inner join current_profile
      on current_profile.id = subscriptions.recruiter_id
    where subscriptions.status in ('active', 'lifetime', 'expired')
    order by subscriptions.purchased_at desc nulls last,
             subscriptions.created_at desc,
             subscriptions.id desc
    limit 1
  ),
  selected_plan as (
    select plans.*
    from public.plans
    cross join current_profile
    left join current_subscription on true
    where (
        current_subscription.status in ('active', 'lifetime')
        and current_subscription.plan_id = plans.id
      )
      or (
        current_subscription.status = 'expired'
        and plans.slug = 'free'
      )
      or (
        current_subscription.id is null
        and plans.slug = 'free'
      )
    order by (current_subscription.id is not null) desc,
             plans.active desc,
             plans.display_order
    limit 1
  ),
  selected_usage as (
    select
      plan_usage.jobs_posted,
      plan_usage.featured_jobs_used,
      plan_usage.remaining_jobs,
      plan_usage.period_start,
      plan_usage.period_end
    from public.plan_usage
    inner join current_profile
      on current_profile.id = plan_usage.recruiter_id
    left join current_subscription
      on current_subscription.id = plan_usage.subscription_id
    where current_subscription.status in ('active', 'lifetime')
      or plan_usage.subscription_id is null
    order by (current_subscription.id is not null) desc,
             plan_usage.period_start desc,
             plan_usage.id desc
    limit 1
  )
  select
    current_profile.role_mode,
    selected_plan.id,
    selected_plan.slug,
    selected_plan.name,
    selected_plan.description,
    selected_plan.price,
    selected_plan.currency,
    selected_plan.billing_type,
    selected_plan.duration_days,
    selected_plan.job_post_limit,
    selected_plan.featured_job_limit,
    selected_plan.priority_support,
    selected_plan.resume_database_access,
    current_subscription.id,
    current_subscription.status,
    current_subscription.starts_at,
    current_subscription.expires_at,
    current_subscription.purchased_at,
    coalesce(selected_usage.jobs_posted, 0),
    coalesce(selected_usage.featured_jobs_used, 0),
    selected_usage.remaining_jobs,
    selected_usage.period_start,
    selected_usage.period_end
  from current_profile
  inner join selected_plan on true
  left join current_subscription on true
  left join selected_usage on true;
$$;

revoke all on function public.get_my_subscription_snapshot() from public, anon, authenticated;
grant execute on function public.get_my_subscription_snapshot() to authenticated;

comment on function public.get_my_subscription_snapshot() is
  'Owner-safe current recruiter plan, lifecycle status, purchase date, and materialized usage snapshot.';

notify pgrst, 'reload schema';

commit;
