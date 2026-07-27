begin;

set local search_path = public, pg_catalog, pg_temp;

-- Saving and viewing jobs is available to authenticated Job Seekers even when
-- their candidate profile is incomplete. Profile completion remains enforced
-- by the application flow, not by private saved-job storage.
create or replace function public.assert_saved_jobs_candidate()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles as candidate_profile
    where candidate_profile.id = actor_id
      and candidate_profile.role_mode = 'job_seeker'
      and candidate_profile.moderation_status = 'active'
  ) then
    raise exception 'job_seeker_required' using errcode = '42501';
  end if;

  return actor_id;
end;
$$;

revoke all on function public.assert_saved_jobs_candidate() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
