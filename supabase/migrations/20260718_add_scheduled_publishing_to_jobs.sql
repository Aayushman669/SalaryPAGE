begin;

alter table public.jobs
  add column if not exists publish_at timestamptz;

comment on column public.jobs.publish_at is
  'Optional UTC time when a published job becomes publicly visible. Null means visible immediately after publishing.';

create index if not exists jobs_public_publish_at_idx
  on public.jobs (publish_at, published_at desc)
  where status = 'published';

drop policy if exists "Published jobs are readable by everyone" on public.jobs;
create policy "Published jobs are readable by everyone"
  on public.jobs
  for select
  to anon, authenticated
  using (
    status = 'published'
    and published_at is not null
    and (publish_at is null or publish_at <= now())
    and (expires_at is null or expires_at > now())
  );

create or replace function public.activate_due_scheduled_jobs()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  processed_count integer;
begin
  update public.jobs
  set
    published_at = coalesce(publish_at, published_at, now()),
    updated_at = now()
  where status = 'published'
    and publish_at is not null
    and publish_at <= now()
    and (published_at is null or published_at < publish_at);

  get diagnostics processed_count = row_count;

  return processed_count;
end;
$$;

revoke all on function public.activate_due_scheduled_jobs() from public;
revoke all on function public.activate_due_scheduled_jobs() from anon;
revoke all on function public.activate_due_scheduled_jobs() from authenticated;
grant execute on function public.activate_due_scheduled_jobs() to service_role;

commit;

select
  'scheduled_publishing_verification' as verification,
  count(*) filter (
    where status = 'published'
      and publish_at is not null
      and publish_at > now()
  ) as scheduled_jobs,
  count(*) filter (
    where status = 'published'
      and (publish_at is null or publish_at <= now())
  ) as currently_public_jobs
from public.jobs;
