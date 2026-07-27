begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- The jobs, applications, payment-history, and company-verification migrations
-- already provide status/date indexes. These two indexes cover the remaining
-- high-frequency admin list filters without duplicating those indexes.
create index if not exists profiles_role_created_idx
  on public.profiles (role_mode, created_at desc, id desc);

create index if not exists companies_name_idx
  on public.companies (name);

notify pgrst, 'reload schema';

commit;
