begin;

alter table public.user_notifications
  add column if not exists event_type text;

update public.user_notifications
set event_type = case
  when event_type in (
    'application_received',
    'application_status_changed',
    'interview_scheduled',
    'interview_rescheduled',
    'interview_cancelled',
    'job_published',
    'job_closed',
    'admin_message',
    'legacy'
  ) then event_type
  when metadata ->> 'event_type' in (
    'application_received',
    'application_status_changed',
    'interview_scheduled',
    'interview_rescheduled',
    'interview_cancelled',
    'job_published',
    'job_closed',
    'admin_message'
  ) then metadata ->> 'event_type'
  else 'legacy'
end
where event_type is null
   or event_type not in (
     'application_received',
     'application_status_changed',
     'interview_scheduled',
     'interview_rescheduled',
     'interview_cancelled',
     'job_published',
     'job_closed',
     'admin_message',
     'legacy'
   );

alter table public.user_notifications
  alter column event_type set default 'legacy',
  alter column event_type set not null;

alter table public.user_notifications
  drop constraint if exists user_notifications_event_type_check;

alter table public.user_notifications
  add constraint user_notifications_event_type_check
  check (event_type in (
    'application_received',
    'application_status_changed',
    'interview_scheduled',
    'interview_rescheduled',
    'interview_cancelled',
    'job_published',
    'job_closed',
    'admin_message',
    'legacy'
  ));

alter table public.user_notifications
  drop constraint if exists user_notifications_action_href_check;

alter table public.user_notifications
  add constraint user_notifications_action_href_check
  check (
    action_href is null
    or (
      left(action_href, 1) = '/'
      and left(action_href, 2) <> '//'
    )
  );

alter table public.user_notifications enable row level security;

revoke all on public.user_notifications from public, anon, authenticated;
grant select on public.user_notifications to authenticated;
grant update (read_at) on public.user_notifications to authenticated;
grant delete on public.user_notifications to authenticated;
grant select, insert, update, delete on public.user_notifications to service_role;

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

comment on column public.user_notifications.event_type is
  'Typed business event that produced this in-app notification. Legacy rows use legacy.';

comment on table public.user_notifications is
  'Trusted server-created in-app notifications. Authenticated users can only read, mark read, or delete their own rows.';

commit;
