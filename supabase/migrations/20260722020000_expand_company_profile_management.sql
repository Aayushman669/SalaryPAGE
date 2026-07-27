begin;

set local search_path = public, storage, extensions, pg_catalog, pg_temp;

alter table public.companies
  add column if not exists address text,
  add column if not exists mission text,
  add column if not exists vision text,
  add column if not exists culture text,
  add column if not exists github_url text,
  add column if not exists instagram_url text,
  add column if not exists youtube_url text,
  add column if not exists hiring_status text not null default 'hiring';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_hiring_status_check'
      and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_hiring_status_check
      check (hiring_status in ('hiring', 'not_hiring', 'always_hiring'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_address_length_check'
      and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_address_length_check
      check (address is null or char_length(address) <= 240);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'companies_about_sections_length_check'
      and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_about_sections_length_check
      check (
        (mission is null or char_length(mission) <= 4000)
        and (vision is null or char_length(vision) <= 4000)
        and (culture is null or char_length(culture) <= 4000)
      );
  end if;
end;
$$;

create table if not exists public.company_gallery (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null default 'Company gallery image',
  created_at timestamptz not null default now(),
  constraint company_gallery_storage_path_check check (
    storage_path ~ '^[0-9a-f-]{36}/gallery/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  ),
  constraint company_gallery_alt_text_check check (char_length(trim(alt_text)) between 1 and 160)
);

create index if not exists company_gallery_company_created_idx
  on public.company_gallery (company_id, created_at asc);

grant select, insert, update, delete on public.company_gallery to authenticated;

alter table public.company_gallery enable row level security;

drop policy if exists "Recruiters can read their company gallery" on public.company_gallery;
create policy "Recruiters can read their company gallery"
  on public.company_gallery
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.companies as c
      where c.id = company_gallery.company_id
        and (c.recruiter_id = auth.uid() or public.is_admin_actor())
    )
  );

drop policy if exists "Recruiters can add to their company gallery" on public.company_gallery;
create policy "Recruiters can add to their company gallery"
  on public.company_gallery
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.companies as c
      where c.id = company_gallery.company_id
        and c.recruiter_id = auth.uid()
    )
  );

drop policy if exists "Recruiters can update their company gallery" on public.company_gallery;
create policy "Recruiters can update their company gallery"
  on public.company_gallery
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.companies as c
      where c.id = company_gallery.company_id
        and (c.recruiter_id = auth.uid() or public.is_admin_actor())
    )
  )
  with check (
    exists (
      select 1
      from public.companies as c
      where c.id = company_gallery.company_id
        and (c.recruiter_id = auth.uid() or public.is_admin_actor())
    )
  );

drop policy if exists "Recruiters can delete their company gallery" on public.company_gallery;
create policy "Recruiters can delete their company gallery"
  on public.company_gallery
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.companies as c
      where c.id = company_gallery.company_id
        and (c.recruiter_id = auth.uid() or public.is_admin_actor())
    )
  );

drop policy if exists "Recruiters can upload company assets" on storage.objects;
create policy "Recruiters can upload company assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      name ~* '^[0-9a-f-]{36}/(logo|banner)\.(jpg|jpeg|png|webp)$'
      or name ~* '^[0-9a-f-]{36}/gallery/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    )
    and exists (
      select 1
      from public.profiles as p
      where p.id = auth.uid()
        and p.role_mode = 'recruiter'
        and p.profile_completed = true
    )
    and (
      name ~* '^[0-9a-f-]{36}/(logo|banner)\.(jpg|jpeg|png|webp)$'
      or exists (
        select 1
        from public.company_gallery as cg
        join public.companies as c on c.id = cg.company_id
        where c.recruiter_id = auth.uid()
          and cg.storage_path = name
      )
      or exists (
        select 1
        from public.companies as c
        where c.recruiter_id = auth.uid()
      )
    )
  );

drop policy if exists "Recruiters can read their company assets" on storage.objects;
create policy "Recruiters can read their company assets"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Recruiters can update their company assets" on storage.objects;
create policy "Recruiters can update their company assets"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      name ~* '^[0-9a-f-]{36}/(logo|banner)\.(jpg|jpeg|png|webp)$'
      or name ~* '^[0-9a-f-]{36}/gallery/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    )
  );

drop policy if exists "Recruiters can delete their company assets" on storage.objects;
create policy "Recruiters can delete their company assets"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on table public.company_gallery is
  'Private company-owned gallery metadata. Public pages use short-lived signed asset URLs.';

notify pgrst, 'reload schema';

commit;
