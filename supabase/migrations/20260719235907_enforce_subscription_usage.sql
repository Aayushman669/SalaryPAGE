begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- This check is used by the jobs RLS policies. It deliberately accepts only
-- the caller's auth.uid(), so a client cannot ask the function to validate a
-- different recruiter.
create or replace function public.can_recruiter_write_job(
  p_user_id uuid,
  p_job_id uuid,
  p_target_status text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_status text;
  v_remaining_jobs integer;
  v_subscription_status text;
begin
  if p_user_id is null
     or auth.uid() is null
     or p_user_id <> auth.uid()
     or p_target_status not in ('draft', 'pending', 'closed', 'archived') then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = p_user_id
      and profiles.role_mode = 'recruiter'
      and profiles.profile_completed = true
  ) then
    return false;
  end if;

  if p_job_id is not null then
    select jobs.status
    into v_current_status
    from public.jobs
    where jobs.id = p_job_id
      and jobs.created_by = p_user_id;
  end if;

  -- Editing an already-reserved pending job does not consume another slot.
  if p_target_status <> 'pending' or v_current_status = 'pending' then
    return true;
  end if;

  select
    plan_usage.remaining_jobs,
    subscriptions.status
  into
    v_remaining_jobs,
    v_subscription_status
  from public.plan_usage
  inner join public.subscriptions
    on subscriptions.id = plan_usage.subscription_id
  where plan_usage.recruiter_id = p_user_id
    and subscriptions.status in ('active', 'lifetime')
    and (subscriptions.expires_at is null or subscriptions.expires_at > now())
    and (plan_usage.period_end is null or plan_usage.period_end > now())
  order by plan_usage.period_start desc, plan_usage.id desc
  limit 1;

  return v_subscription_status in ('active', 'lifetime')
    and (v_remaining_jobs is null or v_remaining_jobs > 0);
end;
$$;

-- Keep materialized usage synchronized with job mutations. This avoids a
-- count query on every dashboard request while still protecting counters at
-- the database boundary.
create or replace function public.sync_recruiter_plan_usage_for_job()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recruiter_id uuid;
  v_old_consumes boolean := false;
  v_new_consumes boolean := false;
  v_old_featured boolean := false;
  v_new_featured boolean := false;
  v_jobs_delta integer;
  v_featured_delta integer;
  v_usage_id uuid;
  v_plan_limit integer;
  v_featured_limit integer;
  v_jobs_posted integer;
  v_featured_jobs_used integer;
begin
  if tg_op = 'DELETE' then
    v_recruiter_id := old.created_by;
    v_old_consumes := old.status in ('published', 'pending');
    v_old_featured := old.status = 'published' and old.featured = true;
  else
    v_recruiter_id := new.created_by;
    v_new_consumes := new.status in ('published', 'pending');
    v_new_featured := new.status = 'published' and new.featured = true;

    if tg_op = 'UPDATE' then
      v_old_consumes := old.status in ('published', 'pending');
      v_old_featured := old.status = 'published' and old.featured = true;
    end if;
  end if;

  v_jobs_delta :=
    (case when v_new_consumes then 1 else 0 end)
    - (case when v_old_consumes then 1 else 0 end);
  v_featured_delta :=
    (case when v_new_featured then 1 else 0 end)
    - (case when v_old_featured then 1 else 0 end);

  if v_jobs_delta = 0 and v_featured_delta = 0 then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  select
    plan_usage.id,
    plans.job_post_limit,
    plans.featured_job_limit,
    plan_usage.jobs_posted,
    plan_usage.featured_jobs_used
  into
    v_usage_id,
    v_plan_limit,
    v_featured_limit,
    v_jobs_posted,
    v_featured_jobs_used
  from public.plan_usage
  inner join public.subscriptions
    on subscriptions.id = plan_usage.subscription_id
  inner join public.plans
    on plans.id = plan_usage.plan_id
  where plan_usage.recruiter_id = v_recruiter_id
    and subscriptions.status in ('active', 'lifetime')
    and (subscriptions.expires_at is null or subscriptions.expires_at > now())
    and (plan_usage.period_end is null or plan_usage.period_end > now())
  order by plan_usage.period_start desc, plan_usage.id desc
  limit 1
  for update of plan_usage;

  -- A missing usage row is a configuration error. Cleanup actions remain
  -- possible, but any new or continued slot-consuming state is blocked until
  -- the subscription usage record is repaired.
  if v_usage_id is null then
    if v_new_consumes or v_jobs_delta > 0 or v_featured_delta > 0 then
      raise exception using
        errcode = 'P0001',
        message = 'Subscription usage is unavailable for this job action.';
    end if;

    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if v_plan_limit is not null
     and v_jobs_posted + v_jobs_delta > v_plan_limit then
    raise exception using
      errcode = 'P0001',
      message = 'The current subscription job limit has been reached.';
  end if;

  if v_featured_limit is not null
     and v_featured_jobs_used + v_featured_delta > v_featured_limit then
    raise exception using
      errcode = 'P0001',
      message = 'The current subscription featured-job limit has been reached.';
  end if;

  update public.plan_usage
  set
    jobs_posted = v_jobs_posted + v_jobs_delta,
    featured_jobs_used = v_featured_jobs_used + v_featured_delta,
    remaining_jobs = case
      when v_plan_limit is null then null
      else greatest(v_plan_limit - (v_jobs_posted + v_jobs_delta), 0)
    end,
    updated_at = now()
  where plan_usage.id = v_usage_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_recruiter_plan_usage_after_job_write on public.jobs;
create trigger sync_recruiter_plan_usage_after_job_write
after insert or update of created_by, status, featured or delete on public.jobs
for each row execute function public.sync_recruiter_plan_usage_for_job();

drop policy if exists "Recruiters can create their own jobs" on public.jobs;
create policy "Recruiters can create their own jobs"
  on public.jobs
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and status in ('draft', 'pending')
    and public.can_recruiter_write_job(auth.uid(), id, status)
  );

drop policy if exists "Recruiters can update their own jobs" on public.jobs;
create policy "Recruiters can update their own jobs"
  on public.jobs
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and public.can_recruiter_write_job(auth.uid(), id, status)
  );

-- Expiry is server-operated. A cron job or Supabase scheduled invocation can
-- call this function without exposing service-role credentials to the browser.
create or replace function public.expire_due_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expired_count integer;
  v_now timestamptz := now();
begin
  update public.subscriptions
  set
    status = 'expired',
    updated_at = v_now
  where subscriptions.status = 'active'
    and subscriptions.expires_at is not null
    and subscriptions.expires_at <= v_now;

  get diagnostics v_expired_count = row_count;

  update public.plan_usage
  set
    period_end = coalesce(period_end, v_now),
    updated_at = v_now
  where plan_usage.subscription_id in (
    select subscriptions.id
    from public.subscriptions
    where subscriptions.status = 'expired'
      and subscriptions.expires_at is not null
      and subscriptions.expires_at <= v_now
  )
    and plan_usage.period_end is null;

  update public.profiles
  set current_plan = 'free'
  where profiles.id in (
    select subscriptions.recruiter_id
    from public.subscriptions
    where subscriptions.status = 'expired'
      and subscriptions.expires_at is not null
      and subscriptions.expires_at <= v_now
  )
    and not exists (
      select 1
      from public.subscriptions
      where subscriptions.recruiter_id = profiles.id
        and subscriptions.status in ('active', 'lifetime')
        and (subscriptions.expires_at is null or subscriptions.expires_at > v_now)
    );

  return coalesce(v_expired_count, 0);
end;
$$;

revoke all on function public.can_recruiter_write_job(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.can_recruiter_write_job(uuid, uuid, text)
  to authenticated;

revoke all on function public.sync_recruiter_plan_usage_for_job()
  from public, anon, authenticated;

revoke all on function public.expire_due_subscriptions()
  from public, anon, authenticated;
grant execute on function public.expire_due_subscriptions()
  to service_role;

comment on function public.can_recruiter_write_job(uuid, uuid, text) is
  'Checks recruiter ownership, profile completion, and materialized subscription capacity before a job write.';
comment on function public.sync_recruiter_plan_usage_for_job() is
  'Maintains materialized recruiter job and featured-job usage counters after job writes.';
comment on function public.expire_due_subscriptions() is
  'Server-only lifecycle task that marks expired subscriptions and closes their usage periods.';

notify pgrst, 'reload schema';

commit;
