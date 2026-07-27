begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'payment_verification_succeeded',
    'payment_verification_failed',
    'subscription_activation_failed',
    'webhook_signature_failed',
    'webhook_replay_detected',
    'webhook_processing_failed',
    'webhook_processed',
    'rate_limit_exceeded'
  )),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint security_audit_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists security_audit_events_type_created_idx
  on public.security_audit_events (event_type, created_at desc);

create index if not exists security_audit_events_actor_created_idx
  on public.security_audit_events (actor_id, created_at desc)
  where actor_id is not null;

alter table public.security_audit_events enable row level security;
revoke all on public.security_audit_events from public, anon, authenticated;
grant insert, select on public.security_audit_events to service_role;

comment on table public.security_audit_events is
  'Service-role-only security events for payment, webhook, and abuse monitoring. Never store secrets or raw provider payloads.';

commit;
