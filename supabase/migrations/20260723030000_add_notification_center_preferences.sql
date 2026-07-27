begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

alter table public.email_preferences
  add column if not exists admin_messages_in_app boolean not null default true;

comment on column public.email_preferences.admin_messages_in_app is
  'Controls non-security in-app messages created for this account by trusted admin workflows.';

create or replace function public.should_create_in_app_notification(
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
  select role_mode
    into target_role
  from public.profiles
  where id = p_user_id;

  select case
    when p_event_type = 'admin_message' then admin_messages_in_app
    when target_role = 'recruiter' and p_event_type = 'application_received' then new_application_in_app
    when target_role = 'recruiter' and p_event_type = 'application_withdrawn' then candidate_status_updates_in_app
    when target_role = 'recruiter' and p_event_type = 'interview_scheduled' then interview_reminders_in_app
    when target_role = 'recruiter' and p_event_type = 'interview_rescheduled' then interview_rescheduled_in_app
    when target_role = 'recruiter' and p_event_type = 'interview_cancelled' then interview_cancelled_in_app
    when target_role = 'recruiter' and p_event_type in ('interview_completed', 'interview_no_show') then interview_reminders_in_app
    when target_role = 'recruiter' and p_event_type in ('job_published', 'job_closed') then job_expiry_reminders_in_app
    when target_role = 'job_seeker' and p_event_type in ('application_submitted', 'application_status_changed', 'interview_scheduled', 'interview_rescheduled', 'interview_cancelled') then application_updates_in_app
    else true
  end
    into preference_enabled
  from public.email_preferences
  where user_id = p_user_id;

  return coalesce(preference_enabled, true);
end;
$$;

create or replace function public.respect_user_notification_preferences_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.should_create_in_app_notification(new.user_id, new.event_type) then
    return new;
  end if;

  return null;
end;
$$;

revoke all on function public.should_create_in_app_notification(uuid, text) from public, anon, authenticated;
revoke all on function public.respect_user_notification_preferences_before_insert() from public, anon, authenticated;

drop trigger if exists respect_user_notification_preferences_before_insert
  on public.user_notifications;

create trigger respect_user_notification_preferences_before_insert
  before insert on public.user_notifications
  for each row
  execute function public.respect_user_notification_preferences_before_insert();

notify pgrst, 'reload schema';

commit;
