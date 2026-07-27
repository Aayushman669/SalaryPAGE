begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

alter table public.email_preferences
  add column if not exists admin_messages_email boolean not null default true;

alter table public.email_queue
  drop constraint if exists email_queue_category_check;

alter table public.email_queue
  add constraint email_queue_category_check
  check (category in ('admin_messages', 'product_updates', 'job_notifications', 'security_emails'));

alter table public.email_queue
  drop constraint if exists email_queue_event_type_check;

alter table public.email_queue
  add constraint email_queue_event_type_check
  check (
    event_type in (
      'account_created',
      'verify_email_requested',
      'password_reset',
      'job_submitted',
      'job_scheduled',
      'job_published',
      'job_closed',
      'recruiter_account_notification',
      'admin_message',
      'application_received',
      'application_status_changed',
      'application_submitted',
      'application_withdrawn',
      'interview_scheduled',
      'interview_rescheduled',
      'interview_cancelled'
    )
  );

create or replace function public.should_queue_transactional_email(
  p_user_id uuid,
  p_event_type text
)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  target_role text;
  preference_enabled boolean;
begin
  if p_event_type = 'admin_message' then
    select admin_messages_email
      into preference_enabled
    from public.email_preferences
    where user_id = p_user_id;

    return coalesce(preference_enabled, true);
  end if;

  select role_mode
    into target_role
  from public.profiles
  where id = p_user_id;

  if target_role is null or target_role not in ('recruiter', 'job_seeker') then
    return false;
  end if;

  select case
    when target_role = 'recruiter' and p_event_type = 'application_received' then new_application_email
    when target_role = 'recruiter' and p_event_type = 'application_withdrawn' then candidate_status_updates_email
    when target_role = 'recruiter' and p_event_type = 'interview_scheduled' then interview_reminders_email
    when target_role = 'recruiter' and p_event_type = 'interview_rescheduled' then interview_rescheduled_email
    when target_role = 'recruiter' and p_event_type = 'interview_cancelled' then interview_cancelled_email
    when target_role = 'job_seeker' and p_event_type in ('application_submitted', 'application_status_changed') then application_updates_email
    when target_role = 'job_seeker' and p_event_type in ('interview_scheduled', 'interview_rescheduled', 'interview_cancelled') then application_updates_email
    else false
  end
    into preference_enabled
  from public.email_preferences
  where user_id = p_user_id;

  return coalesce(preference_enabled, true);
end;
$$;

create or replace function public.queue_transactional_email_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient_email text;
  full_name text;
  category_name text;
  template_name text;
  interview_at timestamptz;
  interview_timezone text;
begin
  if new.event_type not in (
    'admin_message',
    'application_received',
    'application_status_changed',
    'application_submitted',
    'application_withdrawn',
    'interview_scheduled',
    'interview_rescheduled',
    'interview_cancelled'
  ) then
    return new;
  end if;

  if not public.should_queue_transactional_email(new.user_id, new.event_type) then
    return new;
  end if;

  select
    coalesce(nullif(trim(profile_row.email), ''), nullif(trim(auth_user.email), '')),
    nullif(trim(profile_row.full_name), '')
  into recipient_email, full_name
  from public.profiles as profile_row
  left join auth.users as auth_user on auth_user.id = profile_row.id
  where profile_row.id = new.user_id;

  if recipient_email is null or recipient_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    return new;
  end if;

  if new.event_type in ('interview_scheduled', 'interview_rescheduled', 'interview_cancelled')
     and coalesce(new.metadata ->> 'interview_id', '') ~* '^[0-9a-f-]{36}$' then
    begin
      select scheduled_start, timezone
        into interview_at, interview_timezone
      from public.interviews
      where id = (new.metadata ->> 'interview_id')::uuid;
    exception when others then
      interview_at := null;
      interview_timezone := null;
    end;
  end if;

  category_name := case
    when new.event_type = 'admin_message' then 'admin_messages'
    else 'job_notifications'
  end;

  template_name := case new.event_type
    when 'admin_message' then 'admin_message'
    when 'application_received' then 'new_applicant'
    when 'application_status_changed' then 'application_status_changed'
    when 'application_submitted' then 'application_submitted'
    when 'application_withdrawn' then 'application_status_changed'
    when 'interview_scheduled' then 'interview_scheduled'
    when 'interview_rescheduled' then 'interview_rescheduled'
    when 'interview_cancelled' then 'interview_cancelled'
  end;

  insert into public.email_queue (
    recipient_user_id,
    recipient_email,
    event_type,
    template_key,
    category,
    subject,
    html,
    text,
    template_data,
    dedupe_key,
    status,
    attempts,
    max_attempts,
    next_attempt_at
  ) values (
    new.user_id,
    lower(trim(recipient_email)),
    new.event_type,
    template_name,
    category_name,
    new.title,
    '',
    new.description,
    jsonb_build_object(
      'fullName', coalesce(full_name, 'there'),
      'message', new.description,
      'notificationTitle', new.title,
      'actionHref', case
        when new.action_href like '/%' and new.action_href not like '//%' then new.action_href
        else null
      end,
      'status', new.metadata ->> 'status',
      'interviewAt', interview_at,
      'timezone', interview_timezone
    ),
    'notification-email:' || md5(new.event_key),
    'queued',
    0,
    3,
    now()
  ) on conflict (dedupe_key) do nothing;

  return new;
exception when others then
  raise warning 'Transactional email enqueue failed for notification %', new.event_key;
  return new;
end;
$$;

revoke all on function public.should_queue_transactional_email(uuid, text) from public, anon, authenticated;
revoke all on function public.queue_transactional_email_before_insert() from public, anon, authenticated;

drop trigger if exists queue_transactional_email_before_insert
  on public.user_notifications;

create trigger queue_transactional_email_before_insert
  before insert on public.user_notifications
  for each row
  execute function public.queue_transactional_email_before_insert();

comment on table public.email_queue is
  'Provider-agnostic transactional email outbox. Rows are created by trusted notification events and processed by a protected worker.';

comment on function public.queue_transactional_email_before_insert() is
  'Queues one preference-aware transactional email per trusted notification event without interrupting the business transaction.';

notify pgrst, 'reload schema';

commit;
