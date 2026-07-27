begin;

set local search_path = public, auth, pg_catalog, pg_temp;

-- Role changes remain blocked through ordinary profile updates. This narrowly
-- scoped function is the only self-service exception for an authenticated user
-- switching between the two supported product roles.
create or replace function public.switch_own_role(p_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, pg_catalog, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  updated_profile public.profiles;
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_role not in ('recruiter', 'job_seeker') then
    raise exception 'invalid_profile_role' using errcode = '22023';
  end if;

  update public.profiles
  set role_mode = p_role
  where id = actor_id
  returning * into updated_profile;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.switch_own_role(text) from public, anon;
grant execute on function public.switch_own_role(text) to authenticated;

notify pgrst, 'reload schema';

commit;
