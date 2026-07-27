begin;

create table if not exists public.email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  product_updates boolean not null default true,
  job_notifications boolean not null default true,
  security_emails boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_preferences_security_required_check
    check (security_emails = true)
);

create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recipient_user_id uuid references auth.users(id) on delete set null,
  recipient_email text not null,
  event_type text not null,
  template_key text not null,
  category text not null,
  subject text not null,
  html text not null,
  text text not null,
  template_data jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  next_attempt_at timestamptz default now(),
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  constraint email_queue_recipient_email_check
    check (recipient_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  constraint email_queue_category_check
    check (category in ('product_updates', 'job_notifications', 'security_emails')),
  constraint email_queue_status_check
    check (status in ('queued', 'processing', 'sent', 'failed', 'discarded')),
  constraint email_queue_event_type_check
    check (
      event_type in (
        'account_created',
        'verify_email_requested',
        'password_reset',
        'job_submitted',
        'job_scheduled',
        'job_published',
        'job_closed',
        'recruiter_account_notification'
      )
    ),
  constraint email_queue_attempts_check
    check (attempts >= 0 and max_attempts > 0 and attempts <= max_attempts)
);

create unique index if not exists email_queue_dedupe_key_idx
  on public.email_queue (dedupe_key);

create index if not exists email_queue_status_next_attempt_idx
  on public.email_queue (status, next_attempt_at, created_at)
  where status in ('queued', 'failed');

create index if not exists email_queue_recipient_user_idx
  on public.email_queue (recipient_user_id, created_at desc);

create or replace function public.set_email_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_email_preferences_updated_at on public.email_preferences;
create trigger set_email_preferences_updated_at
  before update on public.email_preferences
  for each row
  execute function public.set_email_updated_at();

drop trigger if exists set_email_queue_updated_at on public.email_queue;
create trigger set_email_queue_updated_at
  before update on public.email_queue
  for each row
  execute function public.set_email_updated_at();

alter table public.email_preferences enable row level security;
alter table public.email_queue enable row level security;

drop policy if exists "Users can read their email preferences" on public.email_preferences;
create policy "Users can read their email preferences"
  on public.email_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create their email preferences" on public.email_preferences;
create policy "Users can create their email preferences"
  on public.email_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid() and security_emails = true);

drop policy if exists "Users can update their email preferences" on public.email_preferences;
create policy "Users can update their email preferences"
  on public.email_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and security_emails = true);

revoke all on public.email_queue from anon;
revoke all on public.email_queue from authenticated;
grant select, insert, update on public.email_preferences to authenticated;

comment on table public.email_preferences is
  'User-controllable email notification preferences. Security emails are always enabled.';

comment on table public.email_queue is
  'Provider-agnostic email outbox queue. Normal app flows enqueue events; protected workers process delivery.';

commit;
