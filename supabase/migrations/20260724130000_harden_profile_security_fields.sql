begin;

set local search_path = public, auth, pg_catalog, pg_temp;

-- Profile authorization and entitlement fields must only change through
-- trusted onboarding, moderation, or payment server workflows.
create or replace function public.prevent_client_profile_authorization_changes()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog, pg_temp
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin')
    or public.is_admin_actor() then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'profile_identity_is_server_managed' using errcode = '42501';
  end if;

  if new.email is distinct from old.email then
    raise exception 'profile_email_changes_must_use_auth' using errcode = '42501';
  end if;

  if new.role_mode is distinct from old.role_mode then
    if old.role_mode is not null
      or old.profile_completed is true
      or new.role_mode not in ('recruiter', 'job_seeker') then
      raise exception 'profile_role_changes_are_admin_only' using errcode = '42501';
    end if;
  end if;

  if new.profile_completed is distinct from old.profile_completed then
    if old.profile_completed is true
      or new.profile_completed is distinct from true
      or new.role_mode not in ('recruiter', 'job_seeker') then
      raise exception 'profile_completion_is_server_managed' using errcode = '42501';
    end if;
  end if;

  if new.moderation_status is distinct from old.moderation_status then
    raise exception 'profile_moderation_status_is_server_managed' using errcode = '42501';
  end if;

  if new.current_plan is distinct from old.current_plan then
    raise exception 'profile_plan_is_server_managed' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_client_profile_authorization_changes()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
