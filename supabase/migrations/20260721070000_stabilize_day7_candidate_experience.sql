begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- Keep saved-job RLS explicit and future-proof. The original policy used a
-- bare candidate_id reference; qualifying it avoids ambiguity if the policy is
-- extended with additional candidate-owned relations later.
drop policy if exists "Candidates can read their own saved jobs"
  on public.saved_jobs;

create policy "Candidates can read their own saved jobs"
  on public.saved_jobs
  for select
  to authenticated
  using (
    saved_jobs.candidate_id = auth.uid()
    and exists (
      select 1
      from public.profiles as candidate_profile
      where candidate_profile.id = auth.uid()
        and candidate_profile.role_mode = 'job_seeker'
        and candidate_profile.moderation_status = 'active'
    )
  );

notify pgrst, 'reload schema';

commit;
