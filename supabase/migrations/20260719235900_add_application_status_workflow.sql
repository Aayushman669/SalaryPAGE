begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

create table if not exists public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.applications(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_by_role text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint application_status_history_previous_status_check
    check (
      previous_status is null
      or previous_status in (
        'applied',
        'reviewing',
        'shortlisted',
        'interview',
        'offered',
        'hired',
        'rejected',
        'withdrawn'
      )
    ),
  constraint application_status_history_new_status_check
    check (
      new_status in (
        'applied',
        'reviewing',
        'shortlisted',
        'interview',
        'offered',
        'hired',
        'rejected',
        'withdrawn'
      )
    ),
  constraint application_status_history_actor_role_check
    check (changed_by_role in ('recruiter', 'job_seeker', 'system')),
  constraint application_status_history_note_length_check
    check (note is null or char_length(note) <= 2000)
);

create index if not exists application_status_history_application_created_idx
  on public.application_status_history (application_id, created_at desc, id desc);

create index if not exists application_status_history_changed_by_created_idx
  on public.application_status_history (changed_by, created_at desc)
  where changed_by is not null;

create unique index if not exists application_status_history_initial_once_idx
  on public.application_status_history (application_id)
  where previous_status is null;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  description text not null,
  action_label text,
  action_href text,
  event_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_notifications_type_check
    check (type in ('success', 'info', 'warning', 'system')),
  constraint user_notifications_title_length_check
    check (char_length(title) between 1 and 160),
  constraint user_notifications_description_length_check
    check (char_length(description) between 1 and 1000),
  constraint user_notifications_action_label_length_check
    check (action_label is null or char_length(action_label) <= 80),
  constraint user_notifications_action_href_check
    check (action_href is null or left(action_href, 1) = '/'),
  constraint user_notifications_event_key_length_check
    check (char_length(event_key) between 1 and 240),
  constraint user_notifications_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists user_notifications_event_key_idx
  on public.user_notifications (event_key);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc, id desc);

create index if not exists user_notifications_user_unread_idx
  on public.user_notifications (user_id, created_at desc, id desc)
  where read_at is null;

create or replace function public.is_valid_recruiter_application_transition(
  p_previous_status text,
  p_new_status text
)
returns boolean
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select case p_previous_status
    when 'applied' then p_new_status in ('reviewing', 'shortlisted', 'rejected')
    when 'reviewing' then p_new_status in ('shortlisted', 'interview', 'rejected')
    when 'shortlisted' then p_new_status in ('interview', 'offered', 'rejected')
    when 'interview' then p_new_status in ('shortlisted', 'offered', 'rejected')
    when 'offered' then p_new_status in ('hired', 'rejected')
    else false
  end;
$$;

create or replace function public.record_initial_application_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.application_status_history (
    application_id,
    previous_status,
    new_status,
    changed_by,
    changed_by_role,
    created_at
  )
  values (
    new.id,
    null,
    new.status,
    new.candidate_id,
    'job_seeker',
    coalesce(new.applied_at, now())
  )
  on conflict (application_id) where previous_status is null do nothing;

  return new;
end;
$$;

drop trigger if exists record_initial_application_status_after_insert
  on public.applications;

create trigger record_initial_application_status_after_insert
  after insert on public.applications
  for each row
  execute function public.record_initial_application_status();

insert into public.application_status_history (
  application_id,
  previous_status,
  new_status,
  changed_by,
  changed_by_role,
  created_at
)
select
  applications.id,
  null,
  applications.status,
  null,
  'system',
  coalesce(applications.applied_at, applications.updated_at, now())
from public.applications
where applications.status in (
  'applied',
  'reviewing',
  'shortlisted',
  'interview',
  'offered',
  'hired',
  'rejected',
  'withdrawn'
)
on conflict (application_id) where previous_status is null do nothing;

create or replace function public.enqueue_application_status_notification(
  p_application_id uuid,
  p_history_id uuid,
  p_new_status text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  notification_description text;
  notification_type text := 'info';
  target_candidate_id uuid;
  target_job_id uuid;
  target_job_title text;
begin
  select
    applications.candidate_id,
    applications.job_id,
    coalesce(nullif(trim(jobs.title), ''), 'this job')
  into target_candidate_id, target_job_id, target_job_title
  from public.applications
  inner join public.jobs on jobs.id = applications.job_id
  where applications.id = p_application_id;

  if target_candidate_id is null then
    return false;
  end if;

  notification_description := case p_new_status
    when 'reviewing' then
      format('Your application for %s is now under review.', target_job_title)
    when 'shortlisted' then
      format('You have been shortlisted for %s.', target_job_title)
    when 'interview' then
      format('Your interview stage has started for %s.', target_job_title)
    when 'offered' then
      format('You received an offer for %s.', target_job_title)
    when 'hired' then
      format('You have been hired for %s.', target_job_title)
    when 'rejected' then
      format('Your application for %s was not selected.', target_job_title)
    else null
  end;

  if notification_description is null then
    return false;
  end if;

  if p_new_status in ('offered', 'hired') then
    notification_type := 'success';
  elsif p_new_status = 'rejected' then
    notification_type := 'system';
  end if;

  insert into public.user_notifications (
    user_id,
    type,
    title,
    description,
    action_label,
    action_href,
    event_key,
    metadata
  )
  values (
    target_candidate_id,
    notification_type,
    'Application update',
    notification_description,
    'View application',
    '/applications',
    'application-status:' || p_history_id::text,
    jsonb_build_object(
      'application_id', p_application_id,
      'job_id', target_job_id,
      'status', p_new_status
    )
  )
  on conflict (event_key) do nothing;

  return found;
end;
$$;

create or replace function public.transition_recruiter_application_status(
  p_application_id uuid,
  p_expected_status text,
  p_new_status text,
  p_note text default null
)
returns table (
  id uuid,
  previous_status text,
  status text,
  updated_at timestamptz,
  history_id uuid,
  history_created_at timestamptz,
  notification_created boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  current_status text;
  created_history_id uuid;
  created_history_at timestamptz;
  did_create_notification boolean := false;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = actor_id
      and profiles.role_mode = 'recruiter'
      and profiles.profile_completed = true
  ) then
    raise exception 'recruiter_required' using errcode = '42501';
  end if;

  select applications.status
  into current_status
  from public.applications
  inner join public.jobs on jobs.id = applications.job_id
  where applications.id = p_application_id
    and applications.recruiter_id = actor_id
    and jobs.created_by = actor_id
  for update of applications;

  if not found then
    raise exception 'application_not_found_or_forbidden' using errcode = '42501';
  end if;

  if current_status is distinct from p_expected_status then
    raise exception 'application_status_conflict'
      using errcode = '40001';
  end if;

  if p_new_status = 'withdrawn'
    or not public.is_valid_recruiter_application_transition(
      current_status,
      p_new_status
    )
  then
    raise exception 'invalid_application_status_transition'
      using errcode = '22023';
  end if;

  update public.applications
  set status = p_new_status
  where applications.id = p_application_id;

  insert into public.application_status_history (
    application_id,
    previous_status,
    new_status,
    changed_by,
    changed_by_role,
    note
  )
  values (
    p_application_id,
    current_status,
    p_new_status,
    actor_id,
    'recruiter',
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning
    application_status_history.id,
    application_status_history.created_at
  into created_history_id, created_history_at;

  begin
    did_create_notification := public.enqueue_application_status_notification(
      p_application_id,
      created_history_id,
      p_new_status
    );
  exception
    when others then
      did_create_notification := false;
      raise warning
        'Application status changed but notification creation failed for application % and history %.',
        p_application_id,
        created_history_id;
  end;

  return query
  select
    applications.id,
    current_status,
    applications.status,
    applications.updated_at,
    created_history_id,
    created_history_at,
    did_create_notification
  from public.applications
  where applications.id = p_application_id;
end;
$$;

create or replace function public.withdraw_candidate_application(
  p_application_id uuid,
  p_expected_status text
)
returns table (
  id uuid,
  previous_status text,
  status text,
  updated_at timestamptz,
  history_id uuid,
  history_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  current_status text;
  created_history_id uuid;
  created_history_at timestamptz;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = actor_id
      and profiles.role_mode = 'job_seeker'
      and profiles.profile_completed = true
  ) then
    raise exception 'job_seeker_required' using errcode = '42501';
  end if;

  select applications.status
  into current_status
  from public.applications
  where applications.id = p_application_id
    and applications.candidate_id = actor_id
  for update;

  if not found then
    raise exception 'application_not_found_or_forbidden' using errcode = '42501';
  end if;

  if current_status is distinct from p_expected_status then
    raise exception 'application_status_conflict'
      using errcode = '40001';
  end if;

  if current_status in ('hired', 'rejected', 'withdrawn') then
    raise exception 'application_cannot_be_withdrawn'
      using errcode = '22023';
  end if;

  update public.applications
  set status = 'withdrawn'
  where applications.id = p_application_id;

  insert into public.application_status_history (
    application_id,
    previous_status,
    new_status,
    changed_by,
    changed_by_role
  )
  values (
    p_application_id,
    current_status,
    'withdrawn',
    actor_id,
    'job_seeker'
  )
  returning
    application_status_history.id,
    application_status_history.created_at
  into created_history_id, created_history_at;

  return query
  select
    applications.id,
    current_status,
    applications.status,
    applications.updated_at,
    created_history_id,
    created_history_at
  from public.applications
  where applications.id = p_application_id;
end;
$$;

create or replace function public.get_application_status_history(
  p_application_id uuid
)
returns table (
  id uuid,
  application_id uuid,
  previous_status text,
  new_status text,
  changed_by_role text,
  changed_by_display text,
  note text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    history.id,
    history.application_id,
    history.previous_status,
    history.new_status,
    history.changed_by_role,
    case
      when history.changed_by = auth.uid() then 'You'
      when history.changed_by_role = 'recruiter' then 'Recruiter'
      when history.changed_by_role = 'job_seeker' then
        coalesce(nullif(trim(actor_profile.full_name), ''), 'Candidate')
      else 'System'
    end as changed_by_display,
    case
      when applications.candidate_id = auth.uid() then null::text
      else history.note
    end as note,
    history.created_at
  from public.application_status_history as history
  inner join public.applications
    on applications.id = history.application_id
  inner join public.jobs
    on jobs.id = applications.job_id
  left join public.profiles as actor_profile
    on actor_profile.id = history.changed_by
  where history.application_id = p_application_id
    and (
      (
        applications.candidate_id = auth.uid()
        and exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role_mode = 'job_seeker'
            and profiles.profile_completed = true
        )
      )
      or (
        applications.recruiter_id = auth.uid()
        and jobs.created_by = auth.uid()
        and exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role_mode = 'recruiter'
            and profiles.profile_completed = true
        )
      )
    )
  order by history.created_at desc, history.id desc;
$$;

create or replace function public.get_candidate_application_status_history()
returns table (
  id uuid,
  application_id uuid,
  previous_status text,
  new_status text,
  changed_by_role text,
  changed_by_display text,
  note text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    history.id,
    history.application_id,
    history.previous_status,
    history.new_status,
    history.changed_by_role,
    case
      when history.changed_by = auth.uid() then 'You'
      when history.changed_by_role = 'recruiter' then 'Recruiter'
      when history.changed_by_role = 'job_seeker' then 'Candidate'
      else 'System'
    end as changed_by_display,
    null::text as note,
    history.created_at
  from public.application_status_history as history
  inner join public.applications
    on applications.id = history.application_id
  where applications.candidate_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'job_seeker'
        and profiles.profile_completed = true
    )
  order by history.created_at desc, history.id desc;
$$;

alter table public.application_status_history enable row level security;
alter table public.user_notifications enable row level security;

revoke all on public.application_status_history from public, anon, authenticated;

revoke all on public.user_notifications from public, anon, authenticated;
grant select on public.user_notifications to authenticated;
grant update (read_at) on public.user_notifications to authenticated;
grant delete on public.user_notifications to authenticated;

drop policy if exists "Candidates can read their application status history"
  on public.application_status_history;
create policy "Candidates can read their application status history"
  on public.application_status_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.applications
      where applications.id = application_status_history.application_id
        and applications.candidate_id = auth.uid()
        and exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role_mode = 'job_seeker'
            and profiles.profile_completed = true
        )
    )
  );

drop policy if exists "Recruiters can read status history for their jobs"
  on public.application_status_history;
create policy "Recruiters can read status history for their jobs"
  on public.application_status_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.applications
      inner join public.jobs on jobs.id = applications.job_id
      where applications.id = application_status_history.application_id
        and applications.recruiter_id = auth.uid()
        and jobs.created_by = auth.uid()
        and exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role_mode = 'recruiter'
            and profiles.profile_completed = true
        )
    )
  );

drop policy if exists "Users can read their own notifications"
  on public.user_notifications;
create policy "Users can read their own notifications"
  on public.user_notifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can mark their own notifications as read"
  on public.user_notifications;
create policy "Users can mark their own notifications as read"
  on public.user_notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own notifications"
  on public.user_notifications;
create policy "Users can delete their own notifications"
  on public.user_notifications
  for delete
  to authenticated
  using (user_id = auth.uid());

revoke update on public.applications from authenticated;
revoke update (status, withdrawn_at, updated_at) on public.applications
  from authenticated;

drop policy if exists "Candidates can withdraw their own applications"
  on public.applications;
drop policy if exists "Recruiters can update status for their applications"
  on public.applications;

drop function if exists public.update_recruiter_application_status(uuid, text);

revoke all on function public.is_valid_recruiter_application_transition(text, text)
  from public, anon;
grant execute on function public.is_valid_recruiter_application_transition(text, text)
  to authenticated;

revoke all on function public.record_initial_application_status()
  from public, anon, authenticated;
revoke all on function public.enqueue_application_status_notification(uuid, uuid, text)
  from public, anon, authenticated;

revoke all on function public.transition_recruiter_application_status(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.transition_recruiter_application_status(uuid, text, text, text)
  to authenticated;

revoke all on function public.withdraw_candidate_application(uuid, text)
  from public, anon, authenticated;
grant execute on function public.withdraw_candidate_application(uuid, text)
  to authenticated;

revoke all on function public.get_application_status_history(uuid)
  from public, anon, authenticated;
grant execute on function public.get_application_status_history(uuid)
  to authenticated;

revoke all on function public.get_candidate_application_status_history()
  from public, anon, authenticated;
grant execute on function public.get_candidate_application_status_history()
  to authenticated;

comment on table public.application_status_history is
  'Append-only audit trail for application status transitions. Writes occur only through trusted workflow functions.';
comment on table public.user_notifications is
  'Persistent in-app notifications. Application workflow writes are deduplicated by event_key.';
comment on function public.transition_recruiter_application_status(uuid, text, text, text) is
  'Atomically validates recruiter ownership, locks the application, checks the expected status, changes status, records history, and attempts a candidate notification.';
comment on function public.withdraw_candidate_application(uuid, text) is
  'Atomically lets the owning job seeker withdraw a non-final application and records the transition.';

notify pgrst, 'reload schema';

commit;
