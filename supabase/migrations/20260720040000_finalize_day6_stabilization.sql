begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- Recruiters publish directly. A future publish_at value keeps the row out of
-- public queries until the server scheduler makes it visible.
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
     or p_target_status not in ('draft', 'pending', 'published', 'closed', 'archived') then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = p_user_id
      and profiles.role_mode = 'recruiter'
      and profiles.profile_completed = true
      and profiles.moderation_status = 'active'
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

  -- Pending is retained only for legacy rows. It cannot be created or entered
  -- by the current self-service workflow.
  if p_target_status = 'pending' then
    return v_current_status = 'pending';
  end if;

  -- Editing an already slot-consuming job does not reserve another slot.
  if p_target_status in ('draft', 'closed', 'archived')
     or v_current_status in ('pending', 'published') then
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

drop policy if exists "Recruiters can create their own jobs" on public.jobs;
create policy "Recruiters can create their own jobs"
  on public.jobs
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and status in ('draft', 'published')
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
    and status in ('draft', 'pending', 'published', 'closed', 'archived')
    and public.can_recruiter_write_job(auth.uid(), id, status)
  );

-- Keep entitlement state server-managed. Role switching and profile editing do
-- not change current_plan; only trusted activation/expiry functions may do so.
create or replace function public.prevent_client_plan_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if new.current_plan is distinct from old.current_plan then
    raise exception 'current_plan_is_server_managed' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_client_plan_changes_before_update on public.profiles;
create trigger prevent_client_plan_changes_before_update
before update on public.profiles
for each row execute function public.prevent_client_plan_changes();

-- The admin API is protected server-side, and this trigger makes the database
-- enforce the same app_metadata role requirement for every moderation insert.
create or replace function public.validate_moderation_admin()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not exists (
    select 1
    from auth.users
    where auth.users.id = new.admin_id
      and coalesce(auth.users.raw_app_meta_data ->> 'role', '') in ('admin', 'super_admin')
  ) then
    raise exception 'admin_role_required' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_moderation_admin_before_insert on public.moderation_actions;
create trigger validate_moderation_admin_before_insert
before insert on public.moderation_actions
for each row execute function public.validate_moderation_admin();

revoke all on function public.can_recruiter_write_job(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.can_recruiter_write_job(uuid, uuid, text)
  to authenticated;

revoke all on function public.prevent_client_plan_changes()
  from public, anon, authenticated;
revoke all on function public.validate_moderation_admin()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
