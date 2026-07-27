begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- Moderation is an exception layer. All existing self-service workflows remain
-- available by default; these fields only change when an admin action is applied.
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists moderation_status text not null default 'active',
  add column if not exists moderated_at timestamptz;

alter table public.companies
  add column if not exists moderation_status text not null default 'active',
  add column if not exists moderated_at timestamptz;

alter table public.jobs
  add column if not exists moderation_status text not null default 'active',
  add column if not exists moderated_at timestamptz;

alter table public.applications
  add column if not exists moderation_status text not null default 'active',
  add column if not exists moderated_at timestamptz;

alter table public.purchase_history
  add column if not exists moderation_status text not null default 'clear',
  add column if not exists moderated_at timestamptz;

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_moderation_status_check') then
    alter table public.profiles add constraint profiles_moderation_status_check
      check (moderation_status in ('active', 'suspended', 'restricted')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'companies_moderation_status_check') then
    alter table public.companies add constraint companies_moderation_status_check
      check (moderation_status in ('active', 'hidden', 'restricted', 'suspicious')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_moderation_status_check') then
    alter table public.jobs add constraint jobs_moderation_status_check
      check (moderation_status in ('active', 'hidden', 'spam')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'applications_moderation_status_check') then
    alter table public.applications add constraint applications_moderation_status_check
      check (moderation_status in ('active', 'flagged', 'restricted')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchase_history_moderation_status_check') then
    alter table public.purchase_history add constraint purchase_history_moderation_status_check
      check (moderation_status in ('clear', 'review', 'restricted')) not valid;
  end if;
end;
$$;

create index if not exists profiles_moderation_status_idx
  on public.profiles (moderation_status, updated_at desc);
create index if not exists companies_moderation_status_idx
  on public.companies (moderation_status, updated_at desc);
create index if not exists jobs_moderation_status_idx
  on public.jobs (moderation_status, updated_at desc);
create index if not exists applications_moderation_status_idx
  on public.applications (moderation_status, updated_at desc);
create index if not exists purchase_history_moderation_status_idx
  on public.purchase_history (moderation_status, purchased_at desc);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete restrict,
  target_type text not null check (target_type in ('user', 'company', 'job', 'application', 'payment')),
  target_id uuid not null,
  action_type text not null check (action_type in (
    'warn', 'hide', 'unhide', 'suspend', 'restore', 'mark_spam',
    'remove_spam', 'restrict', 'unrestrict', 'review', 'clear_review'
  )),
  reason text not null check (char_length(trim(reason)) between 10 and 4000),
  internal_note text not null default '' check (char_length(internal_note) <= 8000),
  previous_state jsonb not null default '{}'::jsonb,
  new_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete restrict
);

create index if not exists moderation_actions_target_idx
  on public.moderation_actions (target_type, target_id, created_at desc, id desc);
create index if not exists moderation_actions_action_idx
  on public.moderation_actions (action_type, created_at desc, id desc);
create index if not exists moderation_actions_admin_idx
  on public.moderation_actions (admin_id, created_at desc, id desc);

alter table public.moderation_actions enable row level security;
revoke all on public.moderation_actions from public, anon, authenticated;
grant select, insert, update on public.moderation_actions to service_role;

-- Prevent ordinary client updates from changing enforcement state or timestamps.
create or replace function public.prevent_client_moderation_field_changes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
    and not public.is_admin_actor()
    and (
      new.moderation_status is distinct from old.moderation_status
      or new.moderated_at is distinct from old.moderated_at
    ) then
    raise exception 'moderation_fields_are_server_managed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_moderation_field_changes on public.profiles;
create trigger prevent_profile_moderation_field_changes
before update on public.profiles
for each row execute function public.prevent_client_moderation_field_changes();

drop trigger if exists prevent_company_moderation_field_changes on public.companies;
create trigger prevent_company_moderation_field_changes
before update on public.companies
for each row execute function public.prevent_client_moderation_field_changes();

drop trigger if exists prevent_job_moderation_field_changes on public.jobs;
create trigger prevent_job_moderation_field_changes
before update on public.jobs
for each row execute function public.prevent_client_moderation_field_changes();

drop trigger if exists prevent_application_moderation_field_changes on public.applications;
create trigger prevent_application_moderation_field_changes
before update on public.applications
for each row execute function public.prevent_client_moderation_field_changes();

drop trigger if exists prevent_purchase_moderation_field_changes on public.purchase_history;
create trigger prevent_purchase_moderation_field_changes
before update on public.purchase_history
for each row execute function public.prevent_client_moderation_field_changes();

-- Suspended accounts cannot perform authenticated writes. Restricted recruiters
-- may keep their existing drafts, but cannot create or submit additional jobs.
create or replace function public.prevent_moderated_user_writes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  actor_status text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select moderation_status into actor_status
  from public.profiles
  where id = auth.uid();

  if actor_status = 'suspended' then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  if tg_table_name = 'jobs'
    and actor_status = 'restricted'
    and (tg_op = 'INSERT' or new.status in ('pending', 'published')) then
    raise exception 'job_posting_restricted' using errcode = '42501';
  end if;

  if tg_table_name = 'jobs'
    and exists (
      select 1 from public.companies
      where recruiter_id = auth.uid()
        and moderation_status = 'restricted'
    )
    and (tg_op = 'INSERT' or new.status in ('pending', 'published')) then
    raise exception 'company_job_posting_restricted' using errcode = '42501';
  end if;

  if tg_table_name = 'applications'
    and actor_status = 'restricted' then
    raise exception 'account_restricted' using errcode = '42501';
  end if;

  if tg_table_name = 'applications' and tg_op = 'INSERT' then
    if not exists (
      select 1
      from public.jobs
      where jobs.id = new.job_id
        and jobs.status = 'published'
        and jobs.moderation_status = 'active'
        and jobs.published_at is not null
        and (jobs.publish_at is null or jobs.publish_at <= now())
        and (jobs.expires_at is null or jobs.expires_at > now())
    ) then
      raise exception 'job_not_available' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_moderated_job_writes on public.jobs;
create trigger prevent_moderated_job_writes
before insert or update on public.jobs
for each row execute function public.prevent_moderated_user_writes();

drop trigger if exists prevent_moderated_company_writes on public.companies;
create trigger prevent_moderated_company_writes
before insert or update on public.companies
for each row execute function public.prevent_moderated_user_writes();

drop trigger if exists prevent_moderated_application_writes on public.applications;
create trigger prevent_moderated_application_writes
before insert or update on public.applications
for each row execute function public.prevent_moderated_user_writes();

-- Public job policy remains self-service; moderation is the only additional gate.
drop policy if exists "Published jobs are readable by everyone" on public.jobs;
create policy "Published jobs are readable by everyone"
  on public.jobs for select to anon, authenticated
  using (
    moderation_status = 'active'
    and status = 'published'
    and published_at is not null
    and (expires_at is null or expires_at > now())
  );

drop policy if exists "Recruiters can create their own jobs" on public.jobs;
create policy "Recruiters can create their own jobs"
  on public.jobs for insert to authenticated
  with check (
    created_by = auth.uid()
    and status in ('draft', 'pending')
    and public.can_recruiter_write_job(auth.uid(), id, status)
    and exists (
    select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
        and profiles.moderation_status = 'active'
    )
    and not exists (
      select 1 from public.companies
      where companies.recruiter_id = auth.uid()
        and companies.moderation_status = 'restricted'
    )
  );

drop policy if exists "Recruiters can update their own jobs" on public.jobs;
create policy "Recruiters can update their own jobs"
  on public.jobs for update to authenticated
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and status in ('draft', 'pending', 'closed', 'archived')
    and public.can_recruiter_write_job(auth.uid(), id, status)
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
        and profiles.moderation_status = 'active'
    )
  );

drop policy if exists "Recruiters can delete their own drafts" on public.jobs;
create policy "Recruiters can delete their own drafts"
  on public.jobs for delete to authenticated
  using (
    created_by = auth.uid()
    and status = 'draft'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
        and profiles.moderation_status = 'active'
    )
  );

drop policy if exists "Recruiters can create their own company" on public.companies;
create policy "Recruiters can create their own company"
  on public.companies for insert to authenticated
  with check (
    recruiter_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
        and profiles.moderation_status <> 'suspended'
    )
  );

drop policy if exists "Recruiters can update their own company" on public.companies;
create policy "Recruiters can update their own company"
  on public.companies for update to authenticated
  using (recruiter_id = auth.uid() or public.is_admin_actor())
  with check (
    recruiter_id = auth.uid() or public.is_admin_actor()
  );

drop policy if exists "Candidates can create their own applications" on public.applications;
create policy "Candidates can create their own applications"
  on public.applications for insert to authenticated
  with check (
    candidate_id = auth.uid()
    and status = 'applied'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'job_seeker'
        and profiles.profile_completed = true
        and profiles.moderation_status = 'active'
    )
  );

drop policy if exists "Candidates can withdraw their own applications" on public.applications;
create policy "Candidates can withdraw their own applications"
  on public.applications for update to authenticated
  using (
    candidate_id = auth.uid()
    and status <> 'withdrawn'
    and exists (select 1 from public.profiles where id = auth.uid() and moderation_status = 'active')
  )
  with check (candidate_id = auth.uid() and status = 'withdrawn');

drop policy if exists "Recruiters can update status for their applications" on public.applications;
create policy "Recruiters can update status for their applications"
  on public.applications for update to authenticated
  using (
    recruiter_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role_mode = 'recruiter' and profile_completed = true and moderation_status = 'active')
  )
  with check (recruiter_id = auth.uid());

-- Atomic, server-only action application. The API validates the admin session;
-- this function performs target validation, state transition, and audit insert
-- in the same database transaction.
create or replace function public.apply_moderation_action(
  p_admin_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_action_type text,
  p_reason text,
  p_internal_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_type text := lower(trim(coalesce(p_target_type, '')));
  action_type text := lower(trim(coalesce(p_action_type, '')));
  reason text := trim(coalesce(p_reason, ''));
  internal_note text := left(coalesce(p_internal_note, ''), 8000);
  old_status text;
  new_status text;
  previous_state jsonb;
  new_state jsonb;
  reversed_action text;
  prior_action_id uuid;
  action_id uuid;
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'trusted_admin_context_required' using errcode = '42501';
  end if;
  if p_admin_id is null or not exists (select 1 from auth.users where id = p_admin_id) then
    raise exception 'admin_not_found' using errcode = '42501';
  end if;
  if target_type not in ('user', 'company', 'job', 'application', 'payment') then
    raise exception 'invalid_moderation_target' using errcode = '22023';
  end if;
  if action_type not in ('warn', 'hide', 'unhide', 'suspend', 'restore', 'mark_spam', 'remove_spam', 'restrict', 'unrestrict', 'review', 'clear_review') then
    raise exception 'invalid_moderation_action' using errcode = '22023';
  end if;
  if char_length(reason) < 10 then
    raise exception 'moderation_reason_required' using errcode = '22023';
  end if;
  if target_type = 'user' and p_target_id = p_admin_id then
    raise exception 'cannot_moderate_self' using errcode = '42501';
  end if;

  if target_type = 'user' then
    select moderation_status into old_status from public.profiles where id = p_target_id for update;
    if not found then raise exception 'moderation_target_not_found' using errcode = 'P0002'; end if;
    if action_type = 'warn' then new_status := old_status;
    elsif action_type = 'suspend' and old_status in ('active', 'restricted') then new_status := 'suspended';
    elsif action_type = 'restore' and old_status = 'suspended' then new_status := 'active';
    elsif action_type = 'restrict' and old_status = 'active' then new_status := 'restricted';
    elsif action_type = 'unrestrict' and old_status = 'restricted' then new_status := 'active';
    else raise exception 'invalid_moderation_transition' using errcode = '22023'; end if;
    previous_state := jsonb_build_object('moderation_status', old_status);
    update public.profiles set moderation_status = new_status, moderated_at = now() where id = p_target_id;
  elsif target_type = 'company' then
    select moderation_status into old_status from public.companies where id = p_target_id for update;
    if not found then raise exception 'moderation_target_not_found' using errcode = 'P0002'; end if;
    if action_type = 'hide' and old_status in ('active', 'suspicious') then new_status := 'hidden';
    elsif action_type in ('unhide', 'restore') and old_status = 'hidden' then new_status := 'active';
    elsif action_type = 'mark_spam' and old_status = 'active' then new_status := 'suspicious';
    elsif action_type = 'remove_spam' and old_status = 'suspicious' then new_status := 'active';
    elsif action_type = 'restrict' and old_status in ('active', 'suspicious') then new_status := 'restricted';
    elsif action_type = 'unrestrict' and old_status = 'restricted' then new_status := 'active';
    else raise exception 'invalid_moderation_transition' using errcode = '22023'; end if;
    previous_state := jsonb_build_object('moderation_status', old_status);
    update public.companies set moderation_status = new_status, moderated_at = now() where id = p_target_id;
  elsif target_type = 'job' then
    select moderation_status into old_status from public.jobs where id = p_target_id for update;
    if not found then raise exception 'moderation_target_not_found' using errcode = 'P0002'; end if;
    if action_type = 'hide' and old_status = 'active' then new_status := 'hidden';
    elsif action_type in ('unhide', 'restore') and old_status = 'hidden' then new_status := 'active';
    elsif action_type = 'mark_spam' and old_status = 'active' then new_status := 'spam';
    elsif action_type = 'remove_spam' and old_status = 'spam' then new_status := 'active';
    else raise exception 'invalid_moderation_transition' using errcode = '22023'; end if;
    previous_state := jsonb_build_object('moderation_status', old_status);
    update public.jobs set moderation_status = new_status, moderated_at = now() where id = p_target_id;
  elsif target_type = 'application' then
    select moderation_status into old_status from public.applications where id = p_target_id for update;
    if not found then raise exception 'moderation_target_not_found' using errcode = 'P0002'; end if;
    if action_type = 'mark_spam' and old_status = 'active' then new_status := 'flagged';
    elsif action_type = 'remove_spam' and old_status = 'flagged' then new_status := 'active';
    else raise exception 'invalid_moderation_transition' using errcode = '22023'; end if;
    previous_state := jsonb_build_object('moderation_status', old_status);
    update public.applications set moderation_status = new_status, moderated_at = now() where id = p_target_id;
  else
    select moderation_status into old_status from public.purchase_history where id = p_target_id for update;
    if not found then raise exception 'moderation_target_not_found' using errcode = 'P0002'; end if;
    if action_type = 'review' and old_status = 'clear' then new_status := 'review';
    elsif action_type = 'clear_review' and old_status = 'review' then new_status := 'clear';
    elsif action_type = 'restrict' and old_status in ('clear', 'review') then new_status := 'restricted';
    elsif action_type = 'unrestrict' and old_status = 'restricted' then new_status := 'clear';
    else raise exception 'invalid_moderation_transition' using errcode = '22023'; end if;
    previous_state := jsonb_build_object('moderation_status', old_status);
    update public.purchase_history set moderation_status = new_status, moderated_at = now() where id = p_target_id;
  end if;

  new_state := jsonb_build_object('moderation_status', new_status);
  if action_type in ('unhide', 'restore', 'remove_spam', 'unrestrict', 'clear_review') then
    reversed_action := case
      when action_type = 'restore' and target_type = 'user' then 'suspend'
      when action_type in ('unhide', 'restore') then 'hide'
      when action_type = 'remove_spam' then 'mark_spam'
      when action_type = 'unrestrict' then 'restrict'
      else 'review'
    end;
    select id into prior_action_id
    from public.moderation_actions
    where moderation_actions.target_type = target_type
      and moderation_actions.target_id = p_target_id
      and moderation_actions.action_type = reversed_action
      and moderation_actions.reversed_at is null
    order by moderation_actions.created_at desc, moderation_actions.id desc
    limit 1;
    if prior_action_id is not null then
      update public.moderation_actions set reversed_at = now(), reversed_by = p_admin_id where id = prior_action_id;
    end if;
  end if;

  insert into public.moderation_actions (
    admin_id, target_type, target_id, action_type, reason, internal_note,
    previous_state, new_state
  ) values (
    p_admin_id, target_type, p_target_id, action_type, reason, internal_note,
    previous_state, new_state
  ) returning id into action_id;

  return jsonb_build_object('id', action_id, 'target_type', target_type, 'target_id', p_target_id, 'action_type', action_type, 'new_state', new_state);
end;
$$;

revoke all on function public.apply_moderation_action(uuid, text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_moderation_action(uuid, text, uuid, text, text, text) to service_role;

notify pgrst, 'reload schema';

commit;
