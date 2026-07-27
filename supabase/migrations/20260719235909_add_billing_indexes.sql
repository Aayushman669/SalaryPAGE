begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

create index if not exists purchase_history_recruiter_status_purchased_idx
  on public.purchase_history (recruiter_id, status, purchased_at desc, id desc);

create index if not exists purchase_history_recruiter_plan_purchased_idx
  on public.purchase_history (recruiter_id, plan_id, purchased_at desc, id desc);

create index if not exists purchase_history_recruiter_provider_payment_idx
  on public.purchase_history (recruiter_id, payment_provider, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists payment_orders_recruiter_status_created_idx
  on public.payment_orders (recruiter_id, status, created_at desc, id desc);

notify pgrst, 'reload schema';

commit;
