create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  recruiter_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'applied',
  cover_letter text not null default '',
  resume_url text,
  answers jsonb not null default '{}'::jsonb,
  notes text not null default '',
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  reviewed_at timestamptz,
  interview_at timestamptz,
  hired_at timestamptz,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  score numeric(5, 2),
  constraint applications_status_check
    check (status in (
      'applied',
      'reviewing',
      'shortlisted',
      'interview',
      'offered',
      'hired',
      'rejected',
      'withdrawn'
    )),
  constraint applications_cover_letter_length_check
    check (char_length(cover_letter) <= 12000),
  constraint applications_notes_length_check
    check (char_length(notes) <= 12000),
  constraint applications_resume_url_check
    check (
      resume_url is null
      or resume_url ~* '^https?://'
      or resume_url ~* '^[0-9a-f-]{36}/[a-z0-9-]+/[a-z0-9-]+\.pdf$'
    ),
  constraint applications_answers_object_check
    check (jsonb_typeof(answers) = 'object'),
  constraint applications_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint applications_score_range_check
    check (score is null or (score >= 0 and score <= 100))
);

alter table public.applications
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists job_id uuid,
  add column if not exists candidate_id uuid,
  add column if not exists recruiter_id uuid,
  add column if not exists status text default 'applied',
  add column if not exists cover_letter text default '',
  add column if not exists resume_url text,
  add column if not exists answers jsonb default '{}'::jsonb,
  add column if not exists notes text default '',
  add column if not exists applied_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists withdrawn_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists interview_at timestamptz,
  add column if not exists hired_at timestamptz,
  add column if not exists source text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists score numeric(5, 2);

update public.applications
set
  id = coalesce(id, gen_random_uuid()),
  status = coalesce(nullif(status, ''), 'applied'),
  cover_letter = coalesce(cover_letter, ''),
  answers = coalesce(answers, '{}'::jsonb),
  notes = coalesce(notes, ''),
  applied_at = coalesce(applied_at, now()),
  updated_at = coalesce(updated_at, now()),
  metadata = coalesce(metadata, '{}'::jsonb);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_pkey'
  ) then
    alter table public.applications
      add constraint applications_pkey primary key (id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_job_id_fkey'
  ) then
    alter table public.applications
      add constraint applications_job_id_fkey
      foreign key (job_id)
      references public.jobs(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_candidate_id_fkey'
  ) then
    alter table public.applications
      add constraint applications_candidate_id_fkey
      foreign key (candidate_id)
      references public.profiles(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_recruiter_id_fkey'
  ) then
    alter table public.applications
      add constraint applications_recruiter_id_fkey
      foreign key (recruiter_id)
      references public.profiles(id)
      on delete restrict
      not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_status_check'
  ) then
    alter table public.applications
      add constraint applications_status_check
      check (status in (
        'applied',
        'reviewing',
        'shortlisted',
        'interview',
        'offered',
        'hired',
        'rejected',
        'withdrawn'
      ))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_cover_letter_length_check'
  ) then
    alter table public.applications
      add constraint applications_cover_letter_length_check
      check (char_length(cover_letter) <= 12000)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_notes_length_check'
  ) then
    alter table public.applications
      add constraint applications_notes_length_check
      check (char_length(notes) <= 12000)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_resume_url_check'
  ) then
    alter table public.applications
      add constraint applications_resume_url_check
      check (
        resume_url is null
        or resume_url ~* '^https?://'
        or resume_url ~* '^[0-9a-f-]{36}/[a-z0-9-]+/[a-z0-9-]+\.pdf$'
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_answers_object_check'
  ) then
    alter table public.applications
      add constraint applications_answers_object_check
      check (jsonb_typeof(answers) = 'object')
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_metadata_object_check'
  ) then
    alter table public.applications
      add constraint applications_metadata_object_check
      check (jsonb_typeof(metadata) = 'object')
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_score_range_check'
  ) then
    alter table public.applications
      add constraint applications_score_range_check
      check (score is null or (score >= 0 and score <= 100))
      not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_job_candidate_unique'
  ) then
    alter table public.applications
      add constraint applications_job_candidate_unique
      unique (job_id, candidate_id);
  end if;
end;
$$;

create index if not exists applications_job_id_idx
  on public.applications (job_id);

create index if not exists applications_candidate_recent_idx
  on public.applications (candidate_id, applied_at desc, id desc);

create index if not exists applications_candidate_status_recent_idx
  on public.applications (candidate_id, status, applied_at desc, id desc);

create index if not exists applications_recruiter_recent_idx
  on public.applications (recruiter_id, applied_at desc, id desc);

create index if not exists applications_recruiter_status_recent_idx
  on public.applications (recruiter_id, status, applied_at desc, id desc);

create index if not exists applications_job_status_recent_idx
  on public.applications (job_id, status, applied_at desc, id desc);

create index if not exists applications_status_recent_idx
  on public.applications (status, applied_at desc, id desc);

create index if not exists applications_answers_gin_idx
  on public.applications using gin (answers);

create index if not exists applications_metadata_gin_idx
  on public.applications using gin (metadata);

create or replace function public.set_application_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  owner_id uuid;
begin
  if tg_op = 'INSERT' then
    if new.candidate_id is null then
      new.candidate_id := auth.uid();
    end if;

    select jobs.created_by
    into owner_id
    from public.jobs
    where jobs.id = new.job_id;

    if owner_id is null then
      raise exception 'Cannot create application for an unknown job.';
    end if;

    new.recruiter_id := owner_id;
    new.status := coalesce(new.status, 'applied');
    new.cover_letter := coalesce(new.cover_letter, '');
    new.answers := coalesce(new.answers, '{}'::jsonb);
    new.notes := coalesce(new.notes, '');
    new.applied_at := coalesce(new.applied_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    new.metadata := coalesce(new.metadata, '{}'::jsonb);
  else
    new.id := old.id;
    new.job_id := old.job_id;
    new.candidate_id := old.candidate_id;
    new.recruiter_id := old.recruiter_id;
    new.applied_at := old.applied_at;
    new.cover_letter := old.cover_letter;
    new.resume_url := old.resume_url;
    new.answers := old.answers;
    new.updated_at := now();

    if new.status = 'withdrawn' and old.status <> 'withdrawn' then
      new.withdrawn_at := now();
    end if;

    if new.status in ('reviewing', 'shortlisted') and old.status <> new.status then
      new.reviewed_at := now();
    end if;

    if new.status = 'interview' and old.status <> 'interview' then
      new.interview_at := now();
    end if;

    if new.status = 'hired' and old.status <> 'hired' then
      new.hired_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists set_application_system_fields_before_write
  on public.applications;

create trigger set_application_system_fields_before_write
  before insert or update on public.applications
  for each row
  execute function public.set_application_system_fields();

create or replace function public.record_application_created_metric()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if to_regprocedure('public.record_job_application_metric(uuid)') is not null then
    perform public.record_job_application_metric(new.job_id);
  end if;

  return new;
end;
$$;

drop trigger if exists record_application_created_metric_after_insert
  on public.applications;

create trigger record_application_created_metric_after_insert
  after insert on public.applications
  for each row
  execute function public.record_application_created_metric();

create or replace function public.get_recruiter_applications(
  p_job_id uuid default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  job_id uuid,
  candidate_id uuid,
  recruiter_id uuid,
  status text,
  cover_letter text,
  resume_url text,
  answers jsonb,
  notes text,
  applied_at timestamptz,
  updated_at timestamptz,
  withdrawn_at timestamptz,
  reviewed_at timestamptz,
  interview_at timestamptz,
  hired_at timestamptz,
  source text,
  metadata jsonb,
  score numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    applications.id,
    applications.job_id,
    applications.candidate_id,
    applications.recruiter_id,
    applications.status,
    applications.cover_letter,
    applications.resume_url,
    applications.answers,
    applications.notes,
    applications.applied_at,
    applications.updated_at,
    applications.withdrawn_at,
    applications.reviewed_at,
    applications.interview_at,
    applications.hired_at,
    applications.source,
    applications.metadata,
    applications.score
  from public.applications
  inner join public.jobs
    on jobs.id = applications.job_id
  where jobs.created_by = auth.uid()
    and applications.recruiter_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    )
    and (p_job_id is null or applications.job_id = p_job_id)
    and (p_status is null or applications.status = p_status)
  order by applications.applied_at desc, applications.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.update_application_recruiter_notes(
  p_application_id uuid,
  p_notes text
)
returns table (
  id uuid,
  notes text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.applications
  set
    notes = left(coalesce(p_notes, ''), 12000),
    updated_at = now()
  from public.jobs
  where applications.id = p_application_id
    and jobs.id = applications.job_id
    and jobs.created_by = auth.uid()
    and applications.recruiter_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    )
  returning
    applications.id,
    applications.notes,
    applications.updated_at;
$$;

alter table public.applications enable row level security;

revoke all on public.applications from public;
revoke all on public.applications from anon;
revoke all on public.applications from authenticated;

grant select (
  id,
  job_id,
  candidate_id,
  recruiter_id,
  status,
  cover_letter,
  resume_url,
  answers,
  applied_at,
  updated_at,
  withdrawn_at,
  reviewed_at,
  interview_at,
  hired_at,
  source,
  metadata,
  score
) on public.applications to authenticated;

grant insert (
  job_id,
  cover_letter,
  resume_url,
  answers,
  source,
  metadata
) on public.applications to authenticated;

grant update (
  status,
  withdrawn_at,
  updated_at
) on public.applications to authenticated;

revoke all on function public.get_recruiter_applications(uuid, text, integer, integer) from public;
revoke all on function public.get_recruiter_applications(uuid, text, integer, integer) from anon;
revoke all on function public.get_recruiter_applications(uuid, text, integer, integer) from authenticated;
grant execute on function public.get_recruiter_applications(uuid, text, integer, integer) to authenticated;

revoke all on function public.update_application_recruiter_notes(uuid, text) from public;
revoke all on function public.update_application_recruiter_notes(uuid, text) from anon;
revoke all on function public.update_application_recruiter_notes(uuid, text) from authenticated;
grant execute on function public.update_application_recruiter_notes(uuid, text) to authenticated;

drop policy if exists "Candidates can create their own applications"
  on public.applications;

create policy "Candidates can create their own applications"
  on public.applications
  for insert
  to authenticated
  with check (
    candidate_id = auth.uid()
    and status = 'applied'
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'job_seeker'
        and profiles.profile_completed = true
    )
    and exists (
      select 1
      from public.jobs
      where jobs.id = applications.job_id
        and jobs.created_by = applications.recruiter_id
        and jobs.status = 'published'
        and jobs.published_at is not null
        and (jobs.publish_at is null or jobs.publish_at <= now())
        and (jobs.expires_at is null or jobs.expires_at > now())
    )
  );

drop policy if exists "Candidates can read their own applications"
  on public.applications;

create policy "Candidates can read their own applications"
  on public.applications
  for select
  to authenticated
  using (candidate_id = auth.uid());

drop policy if exists "Candidates can withdraw their own applications"
  on public.applications;

create policy "Candidates can withdraw their own applications"
  on public.applications
  for update
  to authenticated
  using (
    candidate_id = auth.uid()
    and status <> 'withdrawn'
  )
  with check (
    candidate_id = auth.uid()
    and status = 'withdrawn'
  );

drop policy if exists "Recruiters can read applications for their jobs"
  on public.applications;

create policy "Recruiters can read applications for their jobs"
  on public.applications
  for select
  to authenticated
  using (
    recruiter_id = auth.uid()
    and exists (
      select 1
      from public.jobs
      where jobs.id = applications.job_id
        and jobs.created_by = auth.uid()
    )
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    )
  );

drop policy if exists "Recruiters can update status for their applications"
  on public.applications;

create policy "Recruiters can update status for their applications"
  on public.applications
  for update
  to authenticated
  using (
    recruiter_id = auth.uid()
    and exists (
      select 1
      from public.jobs
      where jobs.id = applications.job_id
        and jobs.created_by = auth.uid()
    )
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role_mode = 'recruiter'
        and profiles.profile_completed = true
    )
  )
  with check (
    recruiter_id = auth.uid()
    and status in (
      'applied',
      'reviewing',
      'shortlisted',
      'interview',
      'offered',
      'hired',
      'rejected',
      'withdrawn'
    )
  );

do $$
begin
  if not exists (
    select 1 from public.applications where id is null
  ) then
    alter table public.applications alter column id set not null;
  end if;

  if not exists (
    select 1 from public.applications where job_id is null
  ) then
    alter table public.applications alter column job_id set not null;
    alter table public.applications validate constraint applications_job_id_fkey;
  else
    raise notice 'Skipped applications.job_id NOT NULL/FK validation because existing rows contain null job_id values.';
  end if;

  if not exists (
    select 1 from public.applications where candidate_id is null
  ) then
    alter table public.applications alter column candidate_id set not null;
    alter table public.applications validate constraint applications_candidate_id_fkey;
  else
    raise notice 'Skipped applications.candidate_id NOT NULL/FK validation because existing rows contain null candidate_id values.';
  end if;

  if not exists (
    select 1 from public.applications where recruiter_id is null
  ) then
    alter table public.applications alter column recruiter_id set not null;
    alter table public.applications validate constraint applications_recruiter_id_fkey;
  else
    raise notice 'Skipped applications.recruiter_id NOT NULL/FK validation because existing rows contain null recruiter_id values.';
  end if;

  if not exists (
    select 1 from public.applications where status is null
  ) then
    alter table public.applications alter column status set not null;
    alter table public.applications alter column status set default 'applied';
    alter table public.applications validate constraint applications_status_check;
  end if;

  if not exists (
    select 1 from public.applications where cover_letter is null
  ) then
    alter table public.applications alter column cover_letter set not null;
    alter table public.applications alter column cover_letter set default '';
    alter table public.applications validate constraint applications_cover_letter_length_check;
  end if;

  if not exists (
    select 1 from public.applications where answers is null
  ) then
    alter table public.applications alter column answers set not null;
    alter table public.applications alter column answers set default '{}'::jsonb;
    alter table public.applications validate constraint applications_answers_object_check;
  end if;

  if not exists (
    select 1 from public.applications where notes is null
  ) then
    alter table public.applications alter column notes set not null;
    alter table public.applications alter column notes set default '';
    alter table public.applications validate constraint applications_notes_length_check;
  end if;

  if not exists (
    select 1 from public.applications where applied_at is null
  ) then
    alter table public.applications alter column applied_at set not null;
    alter table public.applications alter column applied_at set default now();
  end if;

  if not exists (
    select 1 from public.applications where updated_at is null
  ) then
    alter table public.applications alter column updated_at set not null;
    alter table public.applications alter column updated_at set default now();
  end if;

  if not exists (
    select 1 from public.applications where metadata is null
  ) then
    alter table public.applications alter column metadata set not null;
    alter table public.applications alter column metadata set default '{}'::jsonb;
    alter table public.applications validate constraint applications_metadata_object_check;
  end if;

  alter table public.applications validate constraint applications_resume_url_check;
  alter table public.applications validate constraint applications_score_range_check;
end;
$$;

comment on table public.applications is
  'Production application foundation. Candidates apply to published jobs once; recruiters read/update applications only for jobs they own.';

comment on column public.applications.job_id is
  'Published job that received this application. Deleting the job cascades its applications.';

comment on column public.applications.candidate_id is
  'Authenticated job seeker profile that submitted the application.';

comment on column public.applications.recruiter_id is
  'Recruiter profile that owns the target job, copied from jobs.created_by for fast owner queries.';

comment on column public.applications.status is
  'Allowed lifecycle values: applied, reviewing, shortlisted, interview, offered, hired, rejected, withdrawn.';

comment on column public.applications.answers is
  'Structured application answers reserved for future screening questions.';

comment on column public.applications.notes is
  'Private recruiter notes. Not granted through normal authenticated table reads; owner-checked RPC functions are provided for recruiter access.';

comment on function public.get_recruiter_applications(uuid, text, integer, integer) is
  'Owner-checked recruiter application reader that includes private notes for applications on the current recruiter''s jobs.';

comment on function public.update_application_recruiter_notes(uuid, text) is
  'Owner-checked private notes updater for recruiters. Candidates do not receive notes column privileges.';

select
  'applications_foundation_verification' as verification,
  to_regclass('public.applications') as applications_table,
  count(*) as existing_application_rows
from public.applications;

commit;
