begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- This table is intentionally server/trigger-owned. It gives direct Supabase
-- writes the same burst protection as API mutations without exposing a client
-- writable rate-limit counter.
create table if not exists public.abuse_rate_limit_events (
  id bigint generated always as identity primary key,
  scope text not null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint abuse_rate_limit_events_scope_check
    check (scope in ('job_create', 'application_create'))
);

create index if not exists abuse_rate_limit_events_actor_scope_created_idx
  on public.abuse_rate_limit_events (actor_id, scope, created_at desc);

alter table public.abuse_rate_limit_events enable row level security;
revoke all on public.abuse_rate_limit_events from anon, authenticated;

create or replace function public.enforce_abuse_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  actor_id uuid;
  event_scope text;
  event_limit integer;
  event_window interval;
  recent_events integer;
begin
  -- Trusted server/admin writes do not carry an end-user JWT and are not
  -- subject to end-user burst limits.
  if current_user_id is null then
    return new;
  end if;

  if tg_table_name = 'jobs' then
    actor_id := (to_jsonb(new)->>'created_by')::uuid;
    event_scope := 'job_create';
    event_limit := 20;
    event_window := interval '1 hour';
  elsif tg_table_name = 'applications' then
    actor_id := (to_jsonb(new)->>'candidate_id')::uuid;
    event_scope := 'application_create';
    event_limit := 30;
    event_window := interval '10 minutes';
  else
    return new;
  end if;

  if actor_id is null or actor_id <> current_user_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(event_scope || ':' || actor_id::text, 0)
  );

  delete from public.abuse_rate_limit_events
  where actor_id = current_user_id
    and scope = event_scope
    and created_at < now() - interval '1 day';

  select count(*)::integer
  into recent_events
  from public.abuse_rate_limit_events
  where actor_id = current_user_id
    and scope = event_scope
    and created_at >= now() - event_window;

  if recent_events >= event_limit then
    raise exception 'rate_limit_exceeded'
      using errcode = 'P0001';
  end if;

  insert into public.abuse_rate_limit_events (scope, actor_id)
  values (event_scope, current_user_id);

  return new;
end;
$$;

revoke all on function public.enforce_abuse_rate_limit() from public, anon, authenticated;

drop trigger if exists abuse_rate_limit_after_insert on public.jobs;
create trigger abuse_rate_limit_after_insert
  after insert on public.jobs
  for each row
  execute function public.enforce_abuse_rate_limit();

drop trigger if exists abuse_rate_limit_after_insert on public.applications;
create trigger abuse_rate_limit_after_insert
  after insert on public.applications
  for each row
  execute function public.enforce_abuse_rate_limit();

comment on table public.abuse_rate_limit_events is
  'Private trigger-owned burst counters for direct authenticated job and application writes.';

commit;

