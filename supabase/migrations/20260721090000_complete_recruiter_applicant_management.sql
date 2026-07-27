begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- The original recruiter applicant RPC selected email/avatar fields from
-- candidate_profiles even though those identity fields live on profiles.
-- Keep candidate-specific details in candidate_profiles and identity data in
-- the shared profiles row.

create table if not exists public.application_recruiter_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  recruiter_id uuid not null references public.profiles(id) on delete restrict,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_recruiter_notes_note_check
    check (char_length(trim(note)) between 1 and 12000)
);

create index if not exists application_recruiter_notes_application_created_idx
  on public.application_recruiter_notes (application_id, created_at desc, id desc);

create index if not exists application_recruiter_notes_recruiter_created_idx
  on public.application_recruiter_notes (recruiter_id, created_at desc, id desc);

create table if not exists public.application_recruiter_tags (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  recruiter_id uuid not null references public.profiles(id) on delete restrict,
  tag text not null,
  created_at timestamptz not null default now(),
  constraint application_recruiter_tags_tag_check
    check (tag in ('strong_fit', 'needs_review', 'referral', 'senior_candidate', 'follow_up')),
  constraint application_recruiter_tags_unique
    unique (application_id, recruiter_id, tag)
);

create index if not exists application_recruiter_tags_application_idx
  on public.application_recruiter_tags (application_id, tag);

create index if not exists application_recruiter_tags_recruiter_tag_idx
  on public.application_recruiter_tags (recruiter_id, tag, application_id);

create or replace function public.set_application_recruiter_note_updated_at()
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

drop trigger if exists application_recruiter_notes_set_updated_at
  on public.application_recruiter_notes;
create trigger application_recruiter_notes_set_updated_at
before update on public.application_recruiter_notes
for each row execute function public.set_application_recruiter_note_updated_at();

-- Preserve the single legacy notes field when migrating to the normalized
-- private notes collection. Existing notes have no separate author, so the
-- application owner is recorded as the legacy author.
insert into public.application_recruiter_notes (
  application_id,
  recruiter_id,
  note,
  created_at,
  updated_at
)
select
  application_rows.id,
  application_rows.recruiter_id,
  left(trim(application_rows.notes), 12000),
  application_rows.updated_at,
  application_rows.updated_at
from public.applications as application_rows
where nullif(trim(coalesce(application_rows.notes, '')), '') is not null
  and not exists (
    select 1
    from public.application_recruiter_notes as existing_notes
    where existing_notes.application_id = application_rows.id
  );

alter table public.application_recruiter_notes enable row level security;
alter table public.application_recruiter_tags enable row level security;

revoke all on public.application_recruiter_notes from public, anon, authenticated;
revoke all on public.application_recruiter_tags from public, anon, authenticated;
grant select on public.application_recruiter_notes to authenticated;
grant select on public.application_recruiter_tags to authenticated;

drop policy if exists "Recruiters can read their application notes"
  on public.application_recruiter_notes;
create policy "Recruiters can read their application notes"
  on public.application_recruiter_notes
  for select to authenticated
  using (
    application_recruiter_notes.recruiter_id = auth.uid()
    and exists (
      select 1
      from public.applications as application_rows
      inner join public.jobs as job_rows
        on job_rows.id = application_rows.job_id
      inner join public.profiles as recruiter_profile
        on recruiter_profile.id = auth.uid()
      where application_rows.id = application_recruiter_notes.application_id
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
    )
  );

drop policy if exists "Recruiters can create their application notes"
  on public.application_recruiter_notes;
create policy "Recruiters can create their application notes"
  on public.application_recruiter_notes
  for insert to authenticated
  with check (
    application_recruiter_notes.recruiter_id = auth.uid()
    and exists (
      select 1
      from public.applications as application_rows
      inner join public.jobs as job_rows
        on job_rows.id = application_rows.job_id
      inner join public.profiles as recruiter_profile
        on recruiter_profile.id = auth.uid()
      where application_rows.id = application_recruiter_notes.application_id
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
    )
  );

drop policy if exists "Recruiters can update their application notes"
  on public.application_recruiter_notes;
create policy "Recruiters can update their application notes"
  on public.application_recruiter_notes
  for update to authenticated
  using (
    application_recruiter_notes.recruiter_id = auth.uid()
    and exists (
      select 1
      from public.applications as application_rows
      inner join public.jobs as job_rows
        on job_rows.id = application_rows.job_id
      inner join public.profiles as recruiter_profile
        on recruiter_profile.id = auth.uid()
      where application_rows.id = application_recruiter_notes.application_id
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
    )
  )
  with check (
    application_recruiter_notes.recruiter_id = auth.uid()
    and exists (
      select 1
      from public.applications as application_rows
      inner join public.jobs as job_rows
        on job_rows.id = application_rows.job_id
      inner join public.profiles as recruiter_profile
        on recruiter_profile.id = auth.uid()
      where application_rows.id = application_recruiter_notes.application_id
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
    )
  );

drop policy if exists "Recruiters can delete their application notes"
  on public.application_recruiter_notes;
create policy "Recruiters can delete their application notes"
  on public.application_recruiter_notes
  for delete to authenticated
  using (
    application_recruiter_notes.recruiter_id = auth.uid()
    and exists (
      select 1
      from public.applications as application_rows
      inner join public.jobs as job_rows
        on job_rows.id = application_rows.job_id
      inner join public.profiles as recruiter_profile
        on recruiter_profile.id = auth.uid()
      where application_rows.id = application_recruiter_notes.application_id
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
    )
  );

drop policy if exists "Recruiters can read their application tags"
  on public.application_recruiter_tags;
create policy "Recruiters can read their application tags"
  on public.application_recruiter_tags
  for select to authenticated
  using (
    application_recruiter_tags.recruiter_id = auth.uid()
    and exists (
      select 1
      from public.applications as application_rows
      inner join public.jobs as job_rows
        on job_rows.id = application_rows.job_id
      inner join public.profiles as recruiter_profile
        on recruiter_profile.id = auth.uid()
      where application_rows.id = application_recruiter_tags.application_id
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
    )
  );

drop policy if exists "Recruiters can create their application tags"
  on public.application_recruiter_tags;
create policy "Recruiters can create their application tags"
  on public.application_recruiter_tags
  for insert to authenticated
  with check (
    application_recruiter_tags.recruiter_id = auth.uid()
    and exists (
      select 1
      from public.applications as application_rows
      inner join public.jobs as job_rows
        on job_rows.id = application_rows.job_id
      inner join public.profiles as recruiter_profile
        on recruiter_profile.id = auth.uid()
      where application_rows.id = application_recruiter_tags.application_id
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
    )
  );

drop policy if exists "Recruiters can delete their application tags"
  on public.application_recruiter_tags;
create policy "Recruiters can delete their application tags"
  on public.application_recruiter_tags
  for delete to authenticated
  using (
    application_recruiter_tags.recruiter_id = auth.uid()
    and exists (
      select 1
      from public.applications as application_rows
      inner join public.jobs as job_rows
        on job_rows.id = application_rows.job_id
      inner join public.profiles as recruiter_profile
        on recruiter_profile.id = auth.uid()
      where application_rows.id = application_recruiter_tags.application_id
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
    )
  );

create or replace function public.get_recruiter_application_notes(
  p_application_id uuid
)
returns table (
  id uuid,
  application_id uuid,
  recruiter_id uuid,
  note text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select
    application_notes.id,
    application_notes.application_id,
    application_notes.recruiter_id,
    application_notes.note,
    application_notes.created_at,
    application_notes.updated_at
  from public.application_recruiter_notes as application_notes
  inner join public.applications as application_rows
    on application_rows.id = application_notes.application_id
  inner join public.jobs as job_rows
    on job_rows.id = application_rows.job_id
  inner join public.profiles as recruiter_profile
    on recruiter_profile.id = auth.uid()
  where application_notes.application_id = p_application_id
    and application_notes.recruiter_id = auth.uid()
    and application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid()
    and recruiter_profile.role_mode = 'recruiter'
    and recruiter_profile.profile_completed = true
  order by application_notes.created_at desc, application_notes.id desc;
$$;

create or replace function public.add_recruiter_application_note(
  p_application_id uuid,
  p_note text
)
returns table (
  id uuid,
  application_id uuid,
  recruiter_id uuid,
  note text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  normalized_note text := left(trim(coalesce(p_note, '')), 12000);
begin
  if char_length(normalized_note) = 0 then
    raise exception 'note_required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.applications as application_rows
    inner join public.jobs as job_rows
      on job_rows.id = application_rows.job_id
    inner join public.profiles as recruiter_profile
      on recruiter_profile.id = auth.uid()
    where application_rows.id = p_application_id
      and application_rows.recruiter_id = auth.uid()
      and job_rows.created_by = auth.uid()
      and recruiter_profile.role_mode = 'recruiter'
      and recruiter_profile.profile_completed = true
  ) then
    raise exception 'application_not_found_or_forbidden' using errcode = '42501';
  end if;

  return query
  insert into public.application_recruiter_notes (
    application_id,
    recruiter_id,
    note
  )
  values (
    p_application_id,
    auth.uid(),
    normalized_note
  )
  returning
    application_recruiter_notes.id,
    application_recruiter_notes.application_id,
    application_recruiter_notes.recruiter_id,
    application_recruiter_notes.note,
    application_recruiter_notes.created_at,
    application_recruiter_notes.updated_at;
end;
$$;

create or replace function public.update_recruiter_application_note(
  p_note_id uuid,
  p_note text
)
returns table (
  id uuid,
  application_id uuid,
  recruiter_id uuid,
  note text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  normalized_note text := left(trim(coalesce(p_note, '')), 12000);
begin
  if char_length(normalized_note) = 0 then
    raise exception 'note_required' using errcode = '22023';
  end if;

  return query
  update public.application_recruiter_notes as application_notes
  set note = normalized_note
  where application_notes.id = p_note_id
    and application_notes.recruiter_id = auth.uid()
    and exists (
      select 1
      from public.applications as application_rows
      inner join public.jobs as job_rows
        on job_rows.id = application_rows.job_id
      inner join public.profiles as recruiter_profile
        on recruiter_profile.id = auth.uid()
      where application_rows.id = application_notes.application_id
        and application_rows.recruiter_id = auth.uid()
        and job_rows.created_by = auth.uid()
        and recruiter_profile.role_mode = 'recruiter'
        and recruiter_profile.profile_completed = true
    )
  returning
    application_notes.id,
    application_notes.application_id,
    application_notes.recruiter_id,
    application_notes.note,
    application_notes.created_at,
    application_notes.updated_at;
end;
$$;

create or replace function public.delete_recruiter_application_note(
  p_note_id uuid
)
returns boolean
language sql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  with deleted_note as (
    delete from public.application_recruiter_notes as application_notes
    where application_notes.id = p_note_id
      and application_notes.recruiter_id = auth.uid()
      and exists (
        select 1
        from public.applications as application_rows
        inner join public.jobs as job_rows
          on job_rows.id = application_rows.job_id
        inner join public.profiles as recruiter_profile
          on recruiter_profile.id = auth.uid()
        where application_rows.id = application_notes.application_id
          and application_rows.recruiter_id = auth.uid()
          and job_rows.created_by = auth.uid()
          and recruiter_profile.role_mode = 'recruiter'
          and recruiter_profile.profile_completed = true
      )
    returning application_notes.id
  )
  select exists (select 1 from deleted_note);
$$;

create or replace function public.get_recruiter_application_tags(
  p_application_id uuid
)
returns table (tag text)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select application_tags.tag
  from public.application_recruiter_tags as application_tags
  inner join public.applications as application_rows
    on application_rows.id = application_tags.application_id
  inner join public.jobs as job_rows
    on job_rows.id = application_rows.job_id
  inner join public.profiles as recruiter_profile
    on recruiter_profile.id = auth.uid()
  where application_tags.application_id = p_application_id
    and application_tags.recruiter_id = auth.uid()
    and application_rows.recruiter_id = auth.uid()
    and job_rows.created_by = auth.uid()
    and recruiter_profile.role_mode = 'recruiter'
    and recruiter_profile.profile_completed = true
  order by application_tags.tag;
$$;

create or replace function public.add_recruiter_application_tag(
  p_application_id uuid,
  p_tag text
)
returns table (tag text)
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  normalized_tag text := lower(trim(coalesce(p_tag, '')));
begin
  if normalized_tag not in ('strong_fit', 'needs_review', 'referral', 'senior_candidate', 'follow_up') then
    raise exception 'invalid_application_tag' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.applications as application_rows
    inner join public.jobs as job_rows
      on job_rows.id = application_rows.job_id
    inner join public.profiles as recruiter_profile
      on recruiter_profile.id = auth.uid()
    where application_rows.id = p_application_id
      and application_rows.recruiter_id = auth.uid()
      and job_rows.created_by = auth.uid()
      and recruiter_profile.role_mode = 'recruiter'
      and recruiter_profile.profile_completed = true
  ) then
    raise exception 'application_not_found_or_forbidden' using errcode = '42501';
  end if;

  insert into public.application_recruiter_tags (
    application_id,
    recruiter_id,
    tag
  )
  values (p_application_id, auth.uid(), normalized_tag)
  on conflict (application_id, recruiter_id, tag) do nothing;

  return query
  select application_tags.tag
  from public.application_recruiter_tags as application_tags
  where application_tags.application_id = p_application_id
    and application_tags.recruiter_id = auth.uid()
  order by application_tags.tag;
end;
$$;

create or replace function public.remove_recruiter_application_tag(
  p_application_id uuid,
  p_tag text
)
returns boolean
language sql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  with deleted_tag as (
    delete from public.application_recruiter_tags as application_tags
    where application_tags.application_id = p_application_id
      and application_tags.recruiter_id = auth.uid()
      and application_tags.tag = lower(trim(coalesce(p_tag, '')))
      and exists (
        select 1
        from public.applications as application_rows
        inner join public.jobs as job_rows
          on job_rows.id = application_rows.job_id
        inner join public.profiles as recruiter_profile
          on recruiter_profile.id = auth.uid()
        where application_rows.id = application_tags.application_id
          and application_rows.recruiter_id = auth.uid()
          and job_rows.created_by = auth.uid()
          and recruiter_profile.role_mode = 'recruiter'
          and recruiter_profile.profile_completed = true
      )
    returning application_tags.id
  )
  select exists (select 1 from deleted_tag);
$$;

drop function if exists public.get_recruiter_application_management(
  text,
  text,
  uuid,
  date,
  date,
  text,
  integer,
  integer
);

drop function if exists public.get_recruiter_application_management(
  text,
  text,
  uuid,
  date,
  date,
  text,
  integer,
  integer,
  text,
  boolean,
  text
);

create or replace function public.get_recruiter_application_management(
  p_search text default '',
  p_status text default null,
  p_job_id uuid default null,
  p_date_from date default null,
  p_date_to date default null,
  p_sort text default 'applied_desc',
  p_limit integer default 20,
  p_offset integer default 0,
  p_tag text default null,
  p_resume_available boolean default null,
  p_candidate_location text default null
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
  tags text[],
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  with filtered_applications as (
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
      candidate_identity.full_name as candidate_full_name,
      candidate_identity.email as candidate_email,
      candidate_identity.avatar_url as candidate_avatar_url,
      candidate_profile.location as candidate_location,
      candidate_profile.experience as candidate_experience,
      coalesce(candidate_profile.skills, '{}'::text[]) as candidate_skills,
      job_rows.title as job_title,
      job_rows.slug as job_slug,
      job_rows.company_name,
      coalesce(application_tag_rows.tags, '{}'::text[]) as tags,
      count(*) over () as total_count
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
    where recruiter_profile.role_mode = 'recruiter'
      and recruiter_profile.profile_completed = true
      and application_rows.recruiter_id = auth.uid()
      and job_rows.created_by = auth.uid()
      and (
        p_status is null
        or p_status = ''
        or p_status in ('applied', 'reviewing', 'shortlisted', 'interview', 'offered', 'hired', 'rejected', 'withdrawn')
          and application_rows.status = p_status
      )
      and (p_job_id is null or application_rows.job_id = p_job_id)
      and (p_date_from is null or application_rows.applied_at >= p_date_from::timestamptz)
      and (p_date_to is null or application_rows.applied_at < (p_date_to + 1)::timestamptz)
      and (
        trim(coalesce(p_search, '')) = ''
        or candidate_identity.full_name ilike '%' || trim(p_search) || '%'
        or candidate_identity.email ilike '%' || trim(p_search) || '%'
        or job_rows.title ilike '%' || trim(p_search) || '%'
        or candidate_profile.location ilike '%' || trim(p_search) || '%'
        or exists (
          select 1
          from unnest(coalesce(candidate_profile.skills, '{}'::text[])) as candidate_skill(skill)
          where candidate_skill ilike '%' || trim(p_search) || '%'
        )
      )
      and (
        p_tag is null
        or p_tag = ''
        or exists (
          select 1
          from public.application_recruiter_tags as filter_tags
          where filter_tags.application_id = application_rows.id
            and filter_tags.recruiter_id = auth.uid()
            and filter_tags.tag = p_tag
        )
      )
      and (
        p_resume_available is null
        or (nullif(trim(coalesce(application_rows.resume_url, '')), '') is not null) = p_resume_available
      )
      and (
        p_candidate_location is null
        or p_candidate_location = ''
        or candidate_profile.location ilike '%' || trim(p_candidate_location) || '%'
      )
  )
  select
    filtered_applications.id,
    filtered_applications.job_id,
    filtered_applications.candidate_id,
    filtered_applications.status,
    filtered_applications.cover_letter,
    filtered_applications.resume_url,
    filtered_applications.answers,
    filtered_applications.notes,
    filtered_applications.applied_at,
    filtered_applications.updated_at,
    filtered_applications.candidate_full_name,
    filtered_applications.candidate_email,
    filtered_applications.candidate_avatar_url,
    filtered_applications.candidate_location,
    filtered_applications.candidate_experience,
    filtered_applications.candidate_skills,
    filtered_applications.job_title,
    filtered_applications.job_slug,
    filtered_applications.company_name,
    filtered_applications.tags,
    filtered_applications.total_count
  from filtered_applications
  order by
    case when p_sort = 'applied_asc' then filtered_applications.applied_at end asc nulls last,
    case when p_sort = 'updated_desc' then filtered_applications.updated_at end desc nulls last,
    case when p_sort = 'candidate_asc' then lower(coalesce(filtered_applications.candidate_full_name, filtered_applications.candidate_email, '')) end asc,
    case when p_sort = 'candidate_desc' then lower(coalesce(filtered_applications.candidate_full_name, filtered_applications.candidate_email, '')) end desc,
    case when p_sort = 'job_asc' then lower(coalesce(filtered_applications.job_title, '')) end asc,
    case when p_sort = 'status_asc' then filtered_applications.status end asc,
    filtered_applications.applied_at desc,
    filtered_applications.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_recruiter_application_management(
  text, text, uuid, date, date, text, integer, integer, text, boolean, text
) from public, anon, authenticated;
grant execute on function public.get_recruiter_application_management(
  text, text, uuid, date, date, text, integer, integer, text, boolean, text
) to authenticated;

revoke all on function public.get_recruiter_application_notes(uuid)
  from public, anon, authenticated;
grant execute on function public.get_recruiter_application_notes(uuid)
  to authenticated;

revoke all on function public.add_recruiter_application_note(uuid, text)
  from public, anon, authenticated;
grant execute on function public.add_recruiter_application_note(uuid, text)
  to authenticated;

revoke all on function public.update_recruiter_application_note(uuid, text)
  from public, anon, authenticated;
grant execute on function public.update_recruiter_application_note(uuid, text)
  to authenticated;

revoke all on function public.delete_recruiter_application_note(uuid)
  from public, anon, authenticated;
grant execute on function public.delete_recruiter_application_note(uuid)
  to authenticated;

revoke all on function public.get_recruiter_application_tags(uuid)
  from public, anon, authenticated;
grant execute on function public.get_recruiter_application_tags(uuid)
  to authenticated;

revoke all on function public.add_recruiter_application_tag(uuid, text)
  from public, anon, authenticated;
grant execute on function public.add_recruiter_application_tag(uuid, text)
  to authenticated;

revoke all on function public.remove_recruiter_application_tag(uuid, text)
  from public, anon, authenticated;
grant execute on function public.remove_recruiter_application_tag(uuid, text)
  to authenticated;

comment on table public.application_recruiter_notes is
  'Private recruiter notes attached to recruiter-owned applications.';

comment on table public.application_recruiter_tags is
  'Controlled private tags attached to recruiter-owned applications.';

comment on function public.get_recruiter_application_management(
  text, text, uuid, date, date, text, integer, integer, text, boolean, text
) is
  'Owner-checked recruiter applicant reader with candidate summary, tags, search, filters, sorting, and pagination.';

notify pgrst, 'reload schema';

commit;
