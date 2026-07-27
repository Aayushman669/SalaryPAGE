begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- Keep this migration safe when it is pasted into the SQL editor without the
-- preceding notification-foundation migration having been applied.
alter table public.user_notifications
  add column if not exists event_type text;

update public.user_notifications
set event_type = case
  when metadata ->> 'event_type' in (
    'application_submitted',
    'application_received',
    'application_withdrawn',
    'application_status_changed',
    'interview_scheduled',
    'interview_rescheduled',
    'interview_cancelled',
    'interview_completed',
    'interview_no_show',
    'job_published',
    'job_closed',
    'admin_message'
  ) then metadata ->> 'event_type'
  else 'legacy'
end
where event_type is null;

alter table public.user_notifications
  alter column event_type set default 'legacy',
  alter column event_type set not null;

-- Existing status and interview workflows already write notifications. These
-- event names make those rows consistent with the typed notification API.
alter table public.user_notifications
  drop constraint if exists user_notifications_event_type_check;

alter table public.user_notifications
  add constraint user_notifications_event_type_check
  check (event_type in (
    'application_submitted',
    'application_received',
    'application_withdrawn',
    'application_status_changed',
    'interview_scheduled',
    'interview_rescheduled',
    'interview_cancelled',
    'interview_completed',
    'interview_no_show',
    'job_published',
    'job_closed',
    'admin_message',
    'legacy'
  ));

create or replace function public.infer_user_notification_event_type()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.event_type is distinct from 'legacy' then
    return new;
  end if;

  new.event_type := case
    when new.event_key like 'application-status:%' then 'application_status_changed'
    when new.event_key like 'interview:%:scheduled:%' then 'interview_scheduled'
    when new.event_key like 'interview:%:rescheduled:%' then 'interview_rescheduled'
    when new.event_key like 'interview:%:cancelled:%' then 'interview_cancelled'
    when new.event_key like 'interview:%:completed:%' then 'interview_completed'
    when new.event_key like 'interview:%:no_show:%' then 'interview_no_show'
    else 'legacy'
  end;

  return new;
end;
$$;

drop trigger if exists infer_user_notification_event_type_before_insert
  on public.user_notifications;

create trigger infer_user_notification_event_type_before_insert
  before insert on public.user_notifications
  for each row
  execute function public.infer_user_notification_event_type();

update public.user_notifications
set event_type = case
  when event_key like 'application-status:%' then 'application_status_changed'
  when event_key like 'interview:%:scheduled:%' then 'interview_scheduled'
  when event_key like 'interview:%:rescheduled:%' then 'interview_rescheduled'
  when event_key like 'interview:%:cancelled:%' then 'interview_cancelled'
  when event_key like 'interview:%:completed:%' then 'interview_completed'
  when event_key like 'interview:%:no_show:%' then 'interview_no_show'
  else event_type
end
where event_type = 'legacy';

create or replace function public.create_application_event_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_job_title text;
  target_recruiter_id uuid;
begin
  select
    jobs.created_by,
    coalesce(nullif(trim(jobs.title), ''), 'this job')
  into target_recruiter_id, target_job_title
  from public.jobs
  inner join public.profiles as recruiter_profile
    on recruiter_profile.id = jobs.created_by
   and recruiter_profile.role_mode = 'recruiter'
  where jobs.id = new.job_id
    and jobs.created_by = new.recruiter_id;

  if target_recruiter_id is not null then
    begin
      insert into public.user_notifications (
        user_id,
        event_type,
        type,
        title,
        description,
        action_label,
        action_href,
        event_key,
        metadata
      ) values (
        target_recruiter_id,
        'application_received',
        'info',
        'New application',
        format('A new candidate applied for %s.', target_job_title),
        'Review application',
        '/applications',
        'application:' || new.id::text || ':recruiter-received',
        jsonb_build_object(
          'application_id', new.id,
          'job_id', new.job_id,
          'status', new.status
        )
      ) on conflict (event_key) do nothing;
    exception when others then
      raise warning 'Recruiter application notification failed for %', new.id;
    end;
  end if;

  if exists (
    select 1
    from public.profiles as candidate_profile
    where candidate_profile.id = new.candidate_id
      and candidate_profile.role_mode = 'job_seeker'
  ) then
    begin
      insert into public.user_notifications (
        user_id,
        event_type,
        type,
        title,
        description,
        action_label,
        action_href,
        event_key,
        metadata
      ) values (
        new.candidate_id,
        'application_submitted',
        'success',
        'Application submitted',
        format('Your application for %s was submitted successfully.', coalesce(target_job_title, 'this job')),
        'View application',
        '/applications',
        'application:' || new.id::text || ':candidate-submitted',
        jsonb_build_object(
          'application_id', new.id,
          'job_id', new.job_id,
          'status', new.status
        )
      ) on conflict (event_key) do nothing;
    exception when others then
      raise warning 'Candidate application notification failed for %', new.id;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists create_application_event_notifications_after_insert
  on public.applications;

create trigger create_application_event_notifications_after_insert
  after insert on public.applications
  for each row
  execute function public.create_application_event_notifications();

create or replace function public.create_application_withdrawal_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_job_title text;
  target_recruiter_id uuid;
begin
  if old.status is not distinct from new.status or new.status <> 'withdrawn' then
    return new;
  end if;

  select
    jobs.created_by,
    coalesce(nullif(trim(jobs.title), ''), 'this job')
  into target_recruiter_id, target_job_title
  from public.jobs
  inner join public.profiles as recruiter_profile
    on recruiter_profile.id = jobs.created_by
   and recruiter_profile.role_mode = 'recruiter'
  where jobs.id = new.job_id
    and jobs.created_by = new.recruiter_id;

  if target_recruiter_id is null then
    return new;
  end if;

  begin
    insert into public.user_notifications (
      user_id,
      event_type,
      type,
      title,
      description,
      action_label,
      action_href,
      event_key,
      metadata
    ) values (
      target_recruiter_id,
      'application_withdrawn',
      'info',
      'Application withdrawn',
      format('A candidate withdrew their application for %s.', target_job_title),
      'Review applications',
      '/applications',
      'application:' || new.id::text || ':recruiter-withdrawn',
      jsonb_build_object(
        'application_id', new.id,
        'job_id', new.job_id,
        'status', new.status
      )
    ) on conflict (event_key) do nothing;
  exception when others then
    raise warning 'Application withdrawal notification failed for %', new.id;
  end;

  return new;
end;
$$;

drop trigger if exists create_application_withdrawal_notification_after_update
  on public.applications;

create trigger create_application_withdrawal_notification_after_update
  after update of status on public.applications
  for each row
  execute function public.create_application_withdrawal_notification();

revoke all on function public.infer_user_notification_event_type() from public, anon, authenticated;
revoke all on function public.create_application_event_notifications() from public, anon, authenticated;
revoke all on function public.create_application_withdrawal_notification() from public, anon, authenticated;

comment on function public.create_application_event_notifications() is
  'Creates deduplicated candidate and recruiter notifications after a trusted application insert. Notification failures never abort the application.';

comment on function public.create_application_withdrawal_notification() is
  'Creates a deduplicated recruiter notification when a candidate withdrawal is committed. Notification failures never abort the withdrawal.';

notify pgrst, 'reload schema';

commit;
