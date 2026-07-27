begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  recruiter_id uuid not null references public.profiles(id) on delete restrict,
  interview_type text not null,
  status text not null default 'scheduled',
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  timezone text not null default 'UTC',
  location text,
  meeting_link text,
  phone_number text,
  candidate_instructions text not null default '',
  recruiter_notes text not null default '',
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interviews_type_check
    check (interview_type in ('video', 'phone', 'on_site')),
  constraint interviews_status_check
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  constraint interviews_time_order_check
    check (scheduled_end > scheduled_start),
  constraint interviews_timezone_length_check
    check (char_length(trim(timezone)) between 1 and 64),
  constraint interviews_candidate_instructions_length_check
    check (char_length(candidate_instructions) <= 4000),
  constraint interviews_recruiter_notes_length_check
    check (char_length(recruiter_notes) <= 12000),
  constraint interviews_cancellation_reason_length_check
    check (cancellation_reason is null or char_length(cancellation_reason) <= 1000),
  constraint interviews_video_link_check
    check (meeting_link is null or left(lower(trim(meeting_link)), 8) = 'https://'),
  constraint interviews_cancelled_fields_check
    check (
      (status = 'cancelled' and cancelled_at is not null)
      or (status <> 'cancelled' and cancelled_at is null)
    )
);

create index if not exists interviews_application_idx
  on public.interviews (application_id);
create index if not exists interviews_recruiter_start_idx
  on public.interviews (recruiter_id, scheduled_start asc, id asc);
create index if not exists interviews_recruiter_status_start_idx
  on public.interviews (recruiter_id, status, scheduled_start asc, id asc);
create index if not exists interviews_recruiter_updated_idx
  on public.interviews (recruiter_id, updated_at desc, id desc);

create table if not exists public.interview_events (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  previous_status text,
  new_status text,
  previous_scheduled_start timestamptz,
  previous_scheduled_end timestamptz,
  new_scheduled_start timestamptz,
  new_scheduled_end timestamptz,
  note text,
  created_at timestamptz not null default now(),
  constraint interview_events_type_check
    check (event_type in ('scheduled', 'rescheduled', 'cancelled', 'completed', 'no_show')),
  constraint interview_events_note_length_check
    check (note is null or char_length(note) <= 12000)
);

create index if not exists interview_events_interview_created_idx
  on public.interview_events (interview_id, created_at desc, id desc);

create or replace function public.set_interview_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists interviews_set_updated_at on public.interviews;
create trigger interviews_set_updated_at
before update on public.interviews
for each row execute function public.set_interview_updated_at();

alter table public.interviews enable row level security;
alter table public.interview_events enable row level security;

revoke all on public.interviews from public, anon, authenticated;
revoke all on public.interview_events from public, anon, authenticated;

drop policy if exists "Recruiters can read owned interviews" on public.interviews;
create policy "Recruiters can read owned interviews"
  on public.interviews
  for select to authenticated
  using (
    interviews.recruiter_id = auth.uid()
    and exists (
      select 1
      from public.applications as application_rows
      inner join public.jobs as job_rows on job_rows.id = application_rows.job_id
      inner join public.profiles as recruiter_profile on recruiter_profile.id = auth.uid()
      where application_rows.id = interviews.application_id
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
    )
  );

drop policy if exists "Candidates can read their interviews" on public.interviews;
create policy "Candidates can read their interviews"
  on public.interviews
  for select to authenticated
  using (
    exists (
      select 1
      from public.applications as application_rows
      where application_rows.id = interviews.application_id
        and application_rows.candidate_id = auth.uid()
    )
  );

drop policy if exists "Recruiters can read owned interview events" on public.interview_events;
create policy "Recruiters can read owned interview events"
  on public.interview_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.interviews as interview_rows
      inner join public.applications as application_rows
        on application_rows.id = interview_rows.application_id
      inner join public.jobs as job_rows
        on job_rows.id = application_rows.job_id
      inner join public.profiles as recruiter_profile
        on recruiter_profile.id = auth.uid()
      where interview_rows.id = interview_events.interview_id
        and interview_rows.recruiter_id = auth.uid()
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
    )
  );

create or replace function public.get_recruiter_interviews(
  p_view text default 'all',
  p_search text default '',
  p_status text default null,
  p_interview_type text default null,
  p_job_id uuid default null,
  p_date_from date default null,
  p_date_to date default null,
  p_sort text default 'soonest',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  application_id uuid,
  recruiter_id uuid,
  candidate_id uuid,
  candidate_full_name text,
  candidate_email text,
  candidate_avatar_url text,
  candidate_location text,
  job_id uuid,
  job_title text,
  job_slug text,
  company_name text,
  application_status text,
  interview_type text,
  status text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  timezone text,
  location text,
  meeting_link text,
  phone_number text,
  candidate_instructions text,
  recruiter_notes text,
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  with filtered_interviews as (
    select
      interview_rows.id,
      interview_rows.application_id,
      interview_rows.recruiter_id,
      application_rows.candidate_id,
      candidate_identity.full_name as candidate_full_name,
      candidate_identity.email as candidate_email,
      candidate_identity.avatar_url as candidate_avatar_url,
      candidate_profile.location as candidate_location,
      application_rows.job_id,
      job_rows.title as job_title,
      job_rows.slug as job_slug,
      job_rows.company_name,
      application_rows.status as application_status,
      interview_rows.interview_type,
      interview_rows.status,
      interview_rows.scheduled_start,
      interview_rows.scheduled_end,
      interview_rows.timezone,
      interview_rows.location,
      interview_rows.meeting_link,
      interview_rows.phone_number,
      interview_rows.candidate_instructions,
      interview_rows.recruiter_notes,
      interview_rows.cancellation_reason,
      interview_rows.cancelled_at,
      interview_rows.created_at,
      interview_rows.updated_at,
      count(*) over () as total_count
    from public.interviews as interview_rows
    inner join public.applications as application_rows
      on application_rows.id = interview_rows.application_id
    inner join public.jobs as job_rows
      on job_rows.id = application_rows.job_id
    inner join public.profiles as recruiter_profile
      on recruiter_profile.id = auth.uid()
    inner join public.profiles as candidate_identity
      on candidate_identity.id = application_rows.candidate_id
    left join public.candidate_profiles as candidate_profile
      on candidate_profile.candidate_id = application_rows.candidate_id
    where recruiter_profile.role_mode = 'recruiter'
      and recruiter_profile.profile_completed = true
      and interview_rows.recruiter_id = auth.uid()
      and application_rows.recruiter_id = auth.uid()
      and job_rows.created_by = auth.uid()
      and (
        p_status is null
        or p_status = ''
        or (p_status in ('scheduled', 'completed', 'cancelled', 'no_show') and interview_rows.status = p_status)
      )
      and (
        p_interview_type is null
        or p_interview_type = ''
        or (p_interview_type in ('video', 'phone', 'on_site') and interview_rows.interview_type = p_interview_type)
      )
      and (p_job_id is null or application_rows.job_id = p_job_id)
      and (p_date_from is null or interview_rows.scheduled_start >= p_date_from::timestamptz)
      and (p_date_to is null or interview_rows.scheduled_start < (p_date_to + 1)::timestamptz)
      and (
        trim(coalesce(p_search, '')) = ''
        or candidate_identity.full_name ilike '%' || trim(p_search) || '%'
        or candidate_identity.email ilike '%' || trim(p_search) || '%'
        or job_rows.title ilike '%' || trim(p_search) || '%'
      )
      and (
        p_view is null
        or p_view = ''
        or p_view = 'all'
        or (p_view = 'upcoming' and interview_rows.status = 'scheduled' and interview_rows.scheduled_start >= now())
        or (p_view = 'past' and (interview_rows.status in ('completed', 'no_show') or (interview_rows.status = 'scheduled' and interview_rows.scheduled_start < now())))
        or (p_view = 'cancelled' and interview_rows.status = 'cancelled')
      )
  )
  select
    filtered_interviews.id,
    filtered_interviews.application_id,
    filtered_interviews.recruiter_id,
    filtered_interviews.candidate_id,
    filtered_interviews.candidate_full_name,
    filtered_interviews.candidate_email,
    filtered_interviews.candidate_avatar_url,
    filtered_interviews.candidate_location,
    filtered_interviews.job_id,
    filtered_interviews.job_title,
    filtered_interviews.job_slug,
    filtered_interviews.company_name,
    filtered_interviews.application_status,
    filtered_interviews.interview_type,
    filtered_interviews.status,
    filtered_interviews.scheduled_start,
    filtered_interviews.scheduled_end,
    filtered_interviews.timezone,
    filtered_interviews.location,
    filtered_interviews.meeting_link,
    filtered_interviews.phone_number,
    null::text as candidate_instructions,
    null::text as recruiter_notes,
    null::text as cancellation_reason,
    filtered_interviews.cancelled_at,
    filtered_interviews.created_at,
    filtered_interviews.updated_at,
    filtered_interviews.total_count
  from filtered_interviews
  order by
    case when p_sort = 'soonest' then filtered_interviews.scheduled_start end asc nulls last,
    case when p_sort = 'latest' then filtered_interviews.scheduled_start end desc nulls last,
    case when p_sort = 'updated' then filtered_interviews.updated_at end desc nulls last,
    filtered_interviews.scheduled_start asc,
    filtered_interviews.id asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_recruiter_interview_detail(
  p_interview_id uuid
)
returns table (
  id uuid,
  application_id uuid,
  recruiter_id uuid,
  candidate_id uuid,
  candidate_full_name text,
  candidate_email text,
  candidate_avatar_url text,
  candidate_location text,
  job_id uuid,
  job_title text,
  job_slug text,
  company_name text,
  application_status text,
  interview_type text,
  status text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  timezone text,
  location text,
  meeting_link text,
  phone_number text,
  candidate_instructions text,
  recruiter_notes text,
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    interview_rows.id,
    interview_rows.application_id,
    interview_rows.recruiter_id,
    application_rows.candidate_id,
    candidate_identity.full_name,
    candidate_identity.email,
    candidate_identity.avatar_url,
    candidate_profile.location,
    application_rows.job_id,
    job_rows.title,
    job_rows.slug,
    job_rows.company_name,
    application_rows.status,
    interview_rows.interview_type,
    interview_rows.status,
    interview_rows.scheduled_start,
    interview_rows.scheduled_end,
    interview_rows.timezone,
    interview_rows.location,
    interview_rows.meeting_link,
    interview_rows.phone_number,
    interview_rows.candidate_instructions,
    interview_rows.recruiter_notes,
    interview_rows.cancellation_reason,
    interview_rows.cancelled_at,
    interview_rows.created_at,
    interview_rows.updated_at
  from public.interviews as interview_rows
  inner join public.applications as application_rows on application_rows.id = interview_rows.application_id
  inner join public.jobs as job_rows on job_rows.id = application_rows.job_id
  inner join public.profiles as recruiter_profile on recruiter_profile.id = auth.uid()
  inner join public.profiles as candidate_identity on candidate_identity.id = application_rows.candidate_id
  left join public.candidate_profiles as candidate_profile on candidate_profile.candidate_id = application_rows.candidate_id
  where interview_rows.id = p_interview_id
    and interview_rows.recruiter_id = auth.uid()
    and application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid()
    and recruiter_profile.role_mode = 'recruiter'
    and recruiter_profile.profile_completed = true;
$$;

create or replace function public.get_recruiter_interview_events(
  p_interview_id uuid
)
returns table (
  id uuid,
  event_type text,
  previous_status text,
  new_status text,
  previous_scheduled_start timestamptz,
  previous_scheduled_end timestamptz,
  new_scheduled_start timestamptz,
  new_scheduled_end timestamptz,
  note text,
  actor_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    event_rows.id,
    event_rows.event_type,
    event_rows.previous_status,
    event_rows.new_status,
    event_rows.previous_scheduled_start,
    event_rows.previous_scheduled_end,
    event_rows.new_scheduled_start,
    event_rows.new_scheduled_end,
    event_rows.note,
    coalesce(actor_profile.full_name, 'System') as actor_name,
    event_rows.created_at
  from public.interview_events as event_rows
  inner join public.interviews as interview_rows on interview_rows.id = event_rows.interview_id
  inner join public.applications as application_rows on application_rows.id = interview_rows.application_id
  inner join public.jobs as job_rows on job_rows.id = application_rows.job_id
  left join public.profiles as actor_profile on actor_profile.id = event_rows.actor_id
  where event_rows.interview_id = p_interview_id
    and interview_rows.recruiter_id = auth.uid()
    and application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid()
    and exists (
      select 1
      from public.profiles as recruiter_profile
      where recruiter_profile.id = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
    )
  order by event_rows.created_at desc, event_rows.id desc;
$$;

create or replace function public.get_recruiter_interview_application_options(
  p_limit integer default 100
)
returns table (
  application_id uuid,
  candidate_full_name text,
  job_id uuid,
  job_title text,
  application_status text
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    application_rows.id,
    coalesce(candidate_identity.full_name, 'Unknown Candidate'),
    application_rows.job_id,
    coalesce(job_rows.title, 'Untitled role'),
    application_rows.status
  from public.applications as application_rows
  inner join public.jobs as job_rows on job_rows.id = application_rows.job_id
  inner join public.profiles as recruiter_profile on recruiter_profile.id = auth.uid()
  inner join public.profiles as candidate_identity on candidate_identity.id = application_rows.candidate_id
  where application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid()
    and recruiter_profile.role_mode = 'recruiter'
    and recruiter_profile.profile_completed = true
    and application_rows.status not in ('rejected', 'withdrawn')
  order by application_rows.applied_at desc, application_rows.id desc
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

create or replace function public.get_recruiter_application_detail(
  p_application_id uuid
)
returns table (
  id uuid,
  job_id uuid,
  candidate_id uuid,
  status text,
  cover_letter text,
  resume_url text,
  answers jsonb,
  notes text,
  applied_at timestamptz,
  updated_at timestamptz,
  candidate_full_name text,
  candidate_email text,
  candidate_avatar_url text,
  candidate_location text,
  candidate_experience text,
  candidate_skills text[],
  job_title text,
  job_slug text,
  company_name text,
  tags text[]
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    application_rows.id,
    application_rows.job_id,
    application_rows.candidate_id,
    application_rows.status,
    application_rows.cover_letter,
    application_rows.resume_url,
    application_rows.answers,
    application_rows.notes,
    application_rows.applied_at,
    application_rows.updated_at,
    candidate_identity.full_name,
    candidate_identity.email,
    candidate_identity.avatar_url,
    candidate_profile.location,
    candidate_profile.experience,
    coalesce(candidate_profile.skills, '{}'::text[]),
    job_rows.title,
    job_rows.slug,
    job_rows.company_name,
    coalesce(application_tag_rows.tags, '{}'::text[])
  from public.applications as application_rows
  inner join public.jobs as job_rows
    on job_rows.id = application_rows.job_id
  inner join public.profiles as recruiter_profile
    on recruiter_profile.id = auth.uid()
  inner join public.profiles as candidate_identity
    on candidate_identity.id = application_rows.candidate_id
  left join public.candidate_profiles as candidate_profile
    on candidate_profile.candidate_id = application_rows.candidate_id
  left join lateral (
    select array_agg(application_tags.tag order by application_tags.tag) as tags
    from public.application_recruiter_tags as application_tags
    where application_tags.application_id = application_rows.id
      and application_tags.recruiter_id = auth.uid()
  ) as application_tag_rows on true
  where application_rows.id = p_application_id
    and application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid()
    and recruiter_profile.role_mode = 'recruiter'
    and recruiter_profile.profile_completed = true;
$$;

create or replace function public.check_recruiter_interview_conflict(
  p_interview_id uuid,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz
)
returns table (
  has_conflict boolean,
  conflicting_interview_id uuid,
  conflicting_candidate_name text,
  conflicting_scheduled_start timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    true,
    interview_rows.id,
    coalesce(candidate_identity.full_name, 'Another applicant'),
    interview_rows.scheduled_start
  from public.interviews as interview_rows
  inner join public.applications as application_rows on application_rows.id = interview_rows.application_id
  inner join public.jobs as job_rows on job_rows.id = application_rows.job_id
  inner join public.profiles as recruiter_profile on recruiter_profile.id = auth.uid()
  inner join public.profiles as candidate_identity on candidate_identity.id = application_rows.candidate_id
  where interview_rows.recruiter_id = auth.uid()
    and application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid()
    and recruiter_profile.role_mode = 'recruiter'
    and recruiter_profile.profile_completed = true
    and interview_rows.status = 'scheduled'
    and (p_interview_id is null or interview_rows.id <> p_interview_id)
    and interview_rows.scheduled_start < p_scheduled_end
    and interview_rows.scheduled_end > p_scheduled_start
  order by interview_rows.scheduled_start asc, interview_rows.id asc
  limit 1;
$$;

create or replace function public.count_recruiter_scheduled_interviews()
returns bigint
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select count(*)
  from public.interviews as interview_rows
  inner join public.applications as application_rows on application_rows.id = interview_rows.application_id
  inner join public.jobs as job_rows on job_rows.id = application_rows.job_id
  inner join public.profiles as recruiter_profile on recruiter_profile.id = auth.uid()
  where interview_rows.recruiter_id = auth.uid()
    and application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid()
    and recruiter_profile.role_mode = 'recruiter'
    and recruiter_profile.profile_completed = true
    and interview_rows.status = 'scheduled';
$$;

create or replace function public.get_recruiter_upcoming_interviews(
  p_limit integer default 3
)
returns table (
  id uuid,
  application_id uuid,
  candidate_full_name text,
  job_title text,
  job_slug text,
  interview_type text,
  status text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  timezone text
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    interview_rows.id,
    interview_rows.application_id,
    coalesce(candidate_identity.full_name, 'Unknown Candidate'),
    coalesce(job_rows.title, 'Untitled role'),
    job_rows.slug,
    interview_rows.interview_type,
    interview_rows.status,
    interview_rows.scheduled_start,
    interview_rows.scheduled_end,
    interview_rows.timezone
  from public.interviews as interview_rows
  inner join public.applications as application_rows on application_rows.id = interview_rows.application_id
  inner join public.jobs as job_rows on job_rows.id = application_rows.job_id
  inner join public.profiles as recruiter_profile on recruiter_profile.id = auth.uid()
  inner join public.profiles as candidate_identity on candidate_identity.id = application_rows.candidate_id
  where interview_rows.recruiter_id = auth.uid()
    and application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid()
    and recruiter_profile.role_mode = 'recruiter'
    and recruiter_profile.profile_completed = true
    and interview_rows.status = 'scheduled'
    and interview_rows.scheduled_start >= now()
  order by interview_rows.scheduled_start asc, interview_rows.id asc
  limit least(greatest(coalesce(p_limit, 3), 1), 10);
$$;

create or replace function public.get_candidate_interview_details(
  p_application_id uuid
)
returns table (
  id uuid,
  application_id uuid,
  interview_type text,
  status text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  timezone text,
  location text,
  meeting_link text,
  phone_number text,
  candidate_instructions text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    interview_rows.id,
    interview_rows.application_id,
    interview_rows.interview_type,
    interview_rows.status,
    interview_rows.scheduled_start,
    interview_rows.scheduled_end,
    interview_rows.timezone,
    interview_rows.location,
    case
      when interview_rows.status = 'cancelled' then null
      else interview_rows.meeting_link
    end,
    interview_rows.phone_number,
    interview_rows.candidate_instructions,
    interview_rows.updated_at
  from public.interviews as interview_rows
  inner join public.applications as application_rows on application_rows.id = interview_rows.application_id
  where interview_rows.application_id = p_application_id
    and application_rows.candidate_id = auth.uid()
  order by interview_rows.scheduled_start desc, interview_rows.id desc
  limit 1;
$$;

create or replace function public.schedule_recruiter_interview(
  p_application_id uuid,
  p_interview_type text,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
  p_timezone text,
  p_location text default null,
  p_meeting_link text default null,
  p_phone_number text default null,
  p_candidate_instructions text default '',
  p_recruiter_notes text default '',
  p_ignore_conflict boolean default false
)
returns table (interview_id uuid, status text)
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  target_candidate_id uuid;
  target_job_id uuid;
  target_job_title text;
  application_status_value text;
  new_interview_id uuid;
  new_event_id uuid;
begin
  if p_scheduled_start is null or p_scheduled_end is null or p_scheduled_end <= p_scheduled_start then
    raise exception 'invalid_interview_time' using errcode = '22023';
  end if;
  if p_scheduled_start <= now() then
    raise exception 'interview_must_be_in_future' using errcode = '22023';
  end if;
  if p_interview_type not in ('video', 'phone', 'on_site') then
    raise exception 'invalid_interview_type' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_timezone, '')), '') is null or not exists (select 1 from pg_timezone_names where name = trim(p_timezone)) then
    raise exception 'invalid_interview_timezone' using errcode = '22023';
  end if;
  if p_scheduled_end - p_scheduled_start > interval '24 hours' then
    raise exception 'interview_too_long' using errcode = '22023';
  end if;
  if p_interview_type = 'video' and left(lower(trim(coalesce(p_meeting_link, ''))), 8) <> 'https://' then
    raise exception 'secure_meeting_link_required' using errcode = '22023';
  end if;
  if p_interview_type = 'phone' and length(regexp_replace(coalesce(p_phone_number, ''), '[^0-9]', '', 'g')) < 7 then
    raise exception 'valid_phone_required' using errcode = '22023';
  end if;
  if p_interview_type = 'on_site' and char_length(trim(coalesce(p_location, ''))) < 3 then
    raise exception 'location_required' using errcode = '22023';
  end if;

  select application_rows.candidate_id, application_rows.job_id, application_rows.status, job_rows.title
  into target_candidate_id, target_job_id, application_status_value, target_job_title
  from public.applications as application_rows
  inner join public.jobs as job_rows on job_rows.id = application_rows.job_id
  inner join public.profiles as recruiter_profile on recruiter_profile.id = auth.uid()
  where application_rows.id = p_application_id
    and application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid()
    and recruiter_profile.role_mode = 'recruiter'
    and recruiter_profile.profile_completed = true
  for update of application_rows;

  if target_candidate_id is null or application_status_value in ('rejected', 'withdrawn') then
    raise exception 'application_not_found_or_ineligible' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.interviews as interview_rows
    where interview_rows.recruiter_id = auth.uid()
      and interview_rows.status = 'scheduled'
      and interview_rows.scheduled_start < p_scheduled_end
      and interview_rows.scheduled_end > p_scheduled_start
  ) and not p_ignore_conflict then
    raise exception 'interview_conflict' using errcode = '23P01';
  end if;

  insert into public.interviews (
    application_id, recruiter_id, interview_type, status, scheduled_start, scheduled_end,
    timezone, location, meeting_link, phone_number, candidate_instructions, recruiter_notes
  ) values (
    p_application_id, auth.uid(), p_interview_type, 'scheduled', p_scheduled_start, p_scheduled_end,
    trim(p_timezone), nullif(trim(p_location), ''), nullif(trim(p_meeting_link), ''),
    nullif(trim(p_phone_number), ''), left(trim(coalesce(p_candidate_instructions, '')), 4000),
    left(trim(coalesce(p_recruiter_notes, '')), 12000)
  ) returning id into new_interview_id;

  insert into public.interview_events (
    interview_id, actor_id, event_type, new_status, new_scheduled_start, new_scheduled_end
  ) values (
    new_interview_id, auth.uid(), 'scheduled', 'scheduled', p_scheduled_start, p_scheduled_end
  ) returning id into new_event_id;

  if application_status_value in ('reviewing', 'shortlisted') then
    perform public.transition_recruiter_application_status(
      p_application_id, application_status_value, 'interview', 'Interview scheduled.'
    );
  end if;

  begin
    insert into public.user_notifications (
      user_id, type, title, description, action_label, action_href, event_key, metadata
    ) values (
      target_candidate_id, 'info', 'Interview scheduled',
      format('An interview for %s has been scheduled.', coalesce(target_job_title, 'your application')),
      'View application', '/applications',
      'interview:' || new_interview_id::text || ':scheduled:' || new_event_id::text,
      jsonb_build_object('application_id', p_application_id, 'job_id', target_job_id, 'interview_id', new_interview_id)
    ) on conflict (event_key) do nothing;
  exception when others then
    raise notice 'Interview notification was not created for %', new_interview_id;
  end;

  return query select new_interview_id, 'scheduled'::text;
end;
$$;

create or replace function public.reschedule_recruiter_interview(
  p_interview_id uuid,
  p_interview_type text,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
  p_timezone text,
  p_location text default null,
  p_meeting_link text default null,
  p_phone_number text default null,
  p_candidate_instructions text default '',
  p_recruiter_notes text default '',
  p_ignore_conflict boolean default false
)
returns table (interview_id uuid, status text)
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  target_application_id uuid;
  target_candidate_id uuid;
  target_job_id uuid;
  target_job_title text;
  old_start timestamptz;
  old_end timestamptz;
  old_status text;
  new_event_id uuid;
begin
  if p_scheduled_start is null or p_scheduled_end is null or p_scheduled_end <= p_scheduled_start then
    raise exception 'invalid_interview_time' using errcode = '22023';
  end if;
  if p_scheduled_start <= now() then raise exception 'interview_must_be_in_future' using errcode = '22023'; end if;
  if p_interview_type not in ('video', 'phone', 'on_site') then raise exception 'invalid_interview_type' using errcode = '22023'; end if;
  if nullif(trim(coalesce(p_timezone, '')), '') is null or not exists (select 1 from pg_timezone_names where name = trim(p_timezone)) then raise exception 'invalid_interview_timezone' using errcode = '22023'; end if;
  if p_scheduled_end - p_scheduled_start > interval '24 hours' then raise exception 'interview_too_long' using errcode = '22023'; end if;
  if p_interview_type = 'video' and left(lower(trim(coalesce(p_meeting_link, ''))), 8) <> 'https://' then raise exception 'secure_meeting_link_required' using errcode = '22023'; end if;
  if p_interview_type = 'phone' and length(regexp_replace(coalesce(p_phone_number, ''), '[^0-9]', '', 'g')) < 7 then raise exception 'valid_phone_required' using errcode = '22023'; end if;
  if p_interview_type = 'on_site' and char_length(trim(coalesce(p_location, ''))) < 3 then raise exception 'location_required' using errcode = '22023'; end if;

  select interview_rows.application_id, application_rows.candidate_id, application_rows.job_id, job_rows.title,
    interview_rows.scheduled_start, interview_rows.scheduled_end, interview_rows.status
  into target_application_id, target_candidate_id, target_job_id, target_job_title, old_start, old_end, old_status
  from public.interviews as interview_rows
  inner join public.applications as application_rows on application_rows.id = interview_rows.application_id
  inner join public.jobs as job_rows on job_rows.id = application_rows.job_id
  inner join public.profiles as recruiter_profile on recruiter_profile.id = auth.uid()
  where interview_rows.id = p_interview_id
    and interview_rows.recruiter_id = auth.uid()
    and application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid()
    and recruiter_profile.role_mode = 'recruiter'
    and recruiter_profile.profile_completed = true
  for update of interview_rows;

  if target_application_id is null or old_status <> 'scheduled' then raise exception 'interview_not_reschedulable' using errcode = '42501'; end if;
  if exists (
    select 1 from public.interviews as interview_rows
    where interview_rows.recruiter_id = auth.uid()
      and interview_rows.status = 'scheduled'
      and interview_rows.id <> p_interview_id
      and interview_rows.scheduled_start < p_scheduled_end
      and interview_rows.scheduled_end > p_scheduled_start
  ) and not p_ignore_conflict then raise exception 'interview_conflict' using errcode = '23P01'; end if;

  update public.interviews as interview_rows
  set interview_type = p_interview_type,
      scheduled_start = p_scheduled_start,
      scheduled_end = p_scheduled_end,
      timezone = trim(p_timezone),
      location = nullif(trim(p_location), ''),
      meeting_link = nullif(trim(p_meeting_link), ''),
      phone_number = nullif(trim(p_phone_number), ''),
      candidate_instructions = left(trim(coalesce(p_candidate_instructions, '')), 4000),
      recruiter_notes = left(trim(coalesce(p_recruiter_notes, '')), 12000)
  where interview_rows.id = p_interview_id;

  insert into public.interview_events (
    interview_id, actor_id, event_type, previous_status, new_status,
    previous_scheduled_start, previous_scheduled_end, new_scheduled_start, new_scheduled_end
  ) values (
    p_interview_id, auth.uid(), 'rescheduled', old_status, 'scheduled',
    old_start, old_end, p_scheduled_start, p_scheduled_end
  ) returning id into new_event_id;

  begin
    insert into public.user_notifications (
      user_id, type, title, description, action_label, action_href, event_key, metadata
    ) values (
      target_candidate_id, 'info', 'Interview rescheduled',
      format('Your interview for %s has been rescheduled.', coalesce(target_job_title, 'your application')),
      'View application', '/applications',
      'interview:' || p_interview_id::text || ':rescheduled:' || new_event_id::text,
      jsonb_build_object('application_id', target_application_id, 'job_id', target_job_id, 'interview_id', p_interview_id)
    ) on conflict (event_key) do nothing;
  exception when others then
    raise notice 'Interview notification was not created for %', p_interview_id;
  end;

  return query select p_interview_id, 'scheduled'::text;
end;
$$;

create or replace function public.cancel_recruiter_interview(
  p_interview_id uuid,
  p_cancellation_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  target_application_id uuid;
  target_candidate_id uuid;
  target_job_id uuid;
  target_job_title text;
  old_status text;
  new_event_id uuid;
begin
  if char_length(trim(coalesce(p_cancellation_reason, ''))) < 3 then raise exception 'cancellation_reason_required' using errcode = '22023'; end if;
  select interview_rows.application_id, application_rows.candidate_id, application_rows.job_id, job_rows.title, interview_rows.status
  into target_application_id, target_candidate_id, target_job_id, target_job_title, old_status
  from public.interviews as interview_rows
  inner join public.applications as application_rows on application_rows.id = interview_rows.application_id
  inner join public.jobs as job_rows on job_rows.id = application_rows.job_id
  inner join public.profiles as recruiter_profile on recruiter_profile.id = auth.uid()
  where interview_rows.id = p_interview_id
    and interview_rows.recruiter_id = auth.uid()
    and application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid()
    and recruiter_profile.role_mode = 'recruiter'
    and recruiter_profile.profile_completed = true
  for update of interview_rows;
  if target_application_id is null or old_status <> 'scheduled' then raise exception 'interview_not_cancellable' using errcode = '42501'; end if;

  update public.interviews as interview_rows
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = left(trim(p_cancellation_reason), 1000)
  where interview_rows.id = p_interview_id;
  insert into public.interview_events (interview_id, actor_id, event_type, previous_status, new_status, note)
  values (p_interview_id, auth.uid(), 'cancelled', old_status, 'cancelled', left(trim(p_cancellation_reason), 12000))
  returning id into new_event_id;

  begin
    insert into public.user_notifications (user_id, type, title, description, action_label, action_href, event_key, metadata)
    values (
      target_candidate_id, 'warning', 'Interview cancelled',
      format('Your interview for %s has been cancelled.', coalesce(target_job_title, 'your application')),
      'View application', '/applications',
      'interview:' || p_interview_id::text || ':cancelled:' || new_event_id::text,
      jsonb_build_object('application_id', target_application_id, 'job_id', target_job_id, 'interview_id', p_interview_id)
    ) on conflict (event_key) do nothing;
  exception when others then
    raise notice 'Interview notification was not created for %', p_interview_id;
  end;
  return true;
end;
$$;

create or replace function public.update_recruiter_interview_status(
  p_interview_id uuid,
  p_status text,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  target_application_id uuid;
  target_candidate_id uuid;
  target_job_id uuid;
  target_job_title text;
  old_status text;
  start_time timestamptz;
  new_event_id uuid;
begin
  if p_status not in ('completed', 'no_show') then raise exception 'invalid_interview_status' using errcode = '22023'; end if;
  select interview_rows.application_id, application_rows.candidate_id, application_rows.job_id, job_rows.title, interview_rows.status, interview_rows.scheduled_start
  into target_application_id, target_candidate_id, target_job_id, target_job_title, old_status, start_time
  from public.interviews as interview_rows
  inner join public.applications as application_rows on application_rows.id = interview_rows.application_id
  inner join public.jobs as job_rows on job_rows.id = application_rows.job_id
  inner join public.profiles as recruiter_profile on recruiter_profile.id = auth.uid()
  where interview_rows.id = p_interview_id
    and interview_rows.recruiter_id = auth.uid()
    and application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid()
    and recruiter_profile.role_mode = 'recruiter'
    and recruiter_profile.profile_completed = true
  for update of interview_rows;
  if target_application_id is null or old_status <> 'scheduled' then raise exception 'interview_not_updatable' using errcode = '42501'; end if;
  if start_time > now() then raise exception 'interview_not_started' using errcode = '22023'; end if;

  update public.interviews as interview_rows set status = p_status where interview_rows.id = p_interview_id;
  insert into public.interview_events (interview_id, actor_id, event_type, previous_status, new_status, note)
  values (p_interview_id, auth.uid(), p_status, old_status, p_status, nullif(left(trim(coalesce(p_note, '')), 12000), ''))
  returning id into new_event_id;

  begin
    insert into public.user_notifications (user_id, type, title, description, action_label, action_href, event_key, metadata)
    values (
      target_candidate_id, 'info', 'Interview update',
      format('Your interview for %s was marked %s.', coalesce(target_job_title, 'your application'), replace(p_status, '_', ' ')),
      'View application', '/applications',
      'interview:' || p_interview_id::text || ':' || p_status || ':' || new_event_id::text,
      jsonb_build_object('application_id', target_application_id, 'job_id', target_job_id, 'interview_id', p_interview_id, 'status', p_status)
    ) on conflict (event_key) do nothing;
  exception when others then
    raise notice 'Interview notification was not created for %', p_interview_id;
  end;
  return true;
end;
$$;

revoke all on function public.get_recruiter_interviews(text, text, text, text, uuid, date, date, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_recruiter_interviews(text, text, text, text, uuid, date, date, text, integer, integer) to authenticated;
revoke all on function public.get_recruiter_interview_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_recruiter_interview_detail(uuid) to authenticated;
revoke all on function public.get_recruiter_interview_events(uuid) from public, anon, authenticated;
grant execute on function public.get_recruiter_interview_events(uuid) to authenticated;
revoke all on function public.get_recruiter_interview_application_options(integer) from public, anon, authenticated;
grant execute on function public.get_recruiter_interview_application_options(integer) to authenticated;
revoke all on function public.get_recruiter_application_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_recruiter_application_detail(uuid) to authenticated;
revoke all on function public.check_recruiter_interview_conflict(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.check_recruiter_interview_conflict(uuid, timestamptz, timestamptz) to authenticated;
revoke all on function public.count_recruiter_scheduled_interviews() from public, anon, authenticated;
grant execute on function public.count_recruiter_scheduled_interviews() to authenticated;
revoke all on function public.get_recruiter_upcoming_interviews(integer) from public, anon, authenticated;
grant execute on function public.get_recruiter_upcoming_interviews(integer) to authenticated;
revoke all on function public.get_candidate_interview_details(uuid) from public, anon, authenticated;
grant execute on function public.get_candidate_interview_details(uuid) to authenticated;
revoke all on function public.schedule_recruiter_interview(uuid, text, timestamptz, timestamptz, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.schedule_recruiter_interview(uuid, text, timestamptz, timestamptz, text, text, text, text, text, text, boolean) to authenticated;
revoke all on function public.reschedule_recruiter_interview(uuid, text, timestamptz, timestamptz, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.reschedule_recruiter_interview(uuid, text, timestamptz, timestamptz, text, text, text, text, text, text, boolean) to authenticated;
revoke all on function public.cancel_recruiter_interview(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_recruiter_interview(uuid, text) to authenticated;
revoke all on function public.update_recruiter_interview_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_recruiter_interview_status(uuid, text, text) to authenticated;

comment on table public.interviews is 'Recruiter-owned interviews linked to applications; timestamps are stored in UTC.';
comment on table public.interview_events is 'Immutable interview lifecycle and reschedule history.';

notify pgrst, 'reload schema';

commit;
