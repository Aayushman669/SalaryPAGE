begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

alter table public.security_audit_events
  drop constraint if exists security_audit_events_event_type_check;

alter table public.security_audit_events
  add constraint security_audit_events_event_type_check
  check (event_type in (
    'payment_verification_succeeded',
    'payment_verification_failed',
    'subscription_activation_failed',
    'webhook_signature_failed',
    'webhook_replay_detected',
    'webhook_processing_failed',
    'webhook_processed',
    'rate_limit_exceeded',
    'role_changed',
    'job_deleted',
    'payment_status_changed'
  ));

create index if not exists security_audit_events_target_created_idx
  on public.security_audit_events (target_type, target_id, created_at desc)
  where target_id is not null;

create or replace function public.audit_security_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog, pg_temp
as $$
begin
  if old.role_mode is distinct from new.role_mode then
    insert into public.security_audit_events (
      actor_id,
      event_type,
      severity,
      target_type,
      target_id,
      metadata
    ) values (
      auth.uid(),
      'role_changed',
      'critical',
      'user',
      new.id,
      jsonb_build_object(
        'previous_role', old.role_mode,
        'new_role', new.role_mode
      )
    );
  end if;

  return new;
end;
$$;

create or replace function public.audit_security_job_delete()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog, pg_temp
as $$
begin
  insert into public.security_audit_events (
    actor_id,
    event_type,
    severity,
    target_type,
    target_id,
    metadata
  ) values (
    auth.uid(),
    'job_deleted',
    'warning',
    'job',
    old.id,
    jsonb_build_object('previous_status', old.status)
  );

  return old;
end;
$$;

create or replace function public.audit_security_payment_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog, pg_temp
as $$
begin
  if old.status is distinct from new.status then
    insert into public.security_audit_events (
      actor_id,
      event_type,
      severity,
      target_type,
      target_id,
      metadata
    ) values (
      coalesce(auth.uid(), new.recruiter_id),
      'payment_status_changed',
      case when new.status in ('paid', 'failed') then 'info' else 'warning' end,
      'payment',
      new.id,
      jsonb_build_object(
        'previous_status', old.status,
        'new_status', new.status
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists audit_security_role_change on public.profiles;
create trigger audit_security_role_change
after update of role_mode on public.profiles
for each row execute function public.audit_security_role_change();

drop trigger if exists audit_security_job_delete on public.jobs;
create trigger audit_security_job_delete
after delete on public.jobs
for each row execute function public.audit_security_job_delete();

drop trigger if exists audit_security_payment_status_change on public.payment_orders;
create trigger audit_security_payment_status_change
after update of status on public.payment_orders
for each row execute function public.audit_security_payment_status_change();

revoke all on function public.audit_security_role_change() from public, anon, authenticated;
revoke all on function public.audit_security_job_delete() from public, anon, authenticated;
revoke all on function public.audit_security_payment_status_change() from public, anon, authenticated;

commit;
