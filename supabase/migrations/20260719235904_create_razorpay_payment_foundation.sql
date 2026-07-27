begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- Payment intents make order creation idempotent before a provider order exists.
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.plans(id) on delete restrict,
  provider text not null default 'razorpay',
  provider_order_id text,
  provider_payment_id text,
  idempotency_key text not null,
  amount numeric(12, 2) not null,
  currency char(3) not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_orders_provider_check
    check (provider in ('razorpay')),
  constraint payment_orders_idempotency_key_check
    check (char_length(idempotency_key) between 16 and 128),
  constraint payment_orders_amount_check
    check (amount > 0),
  constraint payment_orders_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint payment_orders_status_check
    check (status in ('pending', 'paid', 'failed', 'cancelled'))
);

create unique index if not exists payment_orders_provider_order_unique_idx
  on public.payment_orders (provider, provider_order_id)
  where provider_order_id is not null;

create unique index if not exists payment_orders_provider_payment_unique_idx
  on public.payment_orders (provider, provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists payment_orders_recruiter_idempotency_unique_idx
  on public.payment_orders (recruiter_id, provider, idempotency_key);

create index if not exists payment_orders_recruiter_created_idx
  on public.payment_orders (recruiter_id, created_at desc, id desc);

create index if not exists payment_orders_status_created_idx
  on public.payment_orders (status, created_at desc, id desc);

-- Keep provider identifiers on the purchase ledger so reconciliation does not
-- depend on JSON metadata or a separate provider-specific table.
alter table public.purchase_history
  add column if not exists provider_order_id text,
  add column if not exists provider_payment_id text;

create unique index if not exists purchase_history_provider_payment_unique_idx
  on public.purchase_history (payment_provider, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists purchase_history_provider_order_idx
  on public.purchase_history (payment_provider, provider_order_id)
  where provider_order_id is not null;

-- Razorpay retries webhooks when a delivery is not acknowledged. This table
-- makes event consumption idempotent without exposing webhook data to clients.
create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  provider_event_id text not null,
  event_type text not null,
  status text not null default 'processing',
  provider_order_id text,
  provider_payment_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint payment_webhook_events_provider_check
    check (provider in ('razorpay')),
  constraint payment_webhook_events_event_id_check
    check (char_length(provider_event_id) between 1 and 200),
  constraint payment_webhook_events_event_type_check
    check (char_length(event_type) between 1 and 120),
  constraint payment_webhook_events_status_check
    check (status in ('processing', 'processed', 'failed')),
  constraint payment_webhook_events_provider_event_unique
    unique (provider, provider_event_id)
);

create index if not exists payment_webhook_events_status_received_idx
  on public.payment_webhook_events (status, received_at desc, id desc);

create index if not exists payment_webhook_events_order_idx
  on public.payment_webhook_events (provider_order_id)
  where provider_order_id is not null;

drop trigger if exists payment_orders_set_updated_at on public.payment_orders;
create trigger payment_orders_set_updated_at
before update on public.payment_orders
for each row execute function public.set_subscription_updated_at();

drop trigger if exists payment_webhook_events_set_updated_at on public.payment_webhook_events;
create trigger payment_webhook_events_set_updated_at
before update on public.payment_webhook_events
for each row execute function public.set_subscription_updated_at();

alter table public.payment_orders enable row level security;
alter table public.payment_webhook_events enable row level security;

revoke all on public.payment_orders from public, anon, authenticated;
revoke all on public.payment_webhook_events from public, anon, authenticated;

grant select on public.payment_orders to authenticated;

drop policy if exists "Owners can read payment orders" on public.payment_orders;
create policy "Owners can read payment orders"
  on public.payment_orders for select
  to authenticated
  using (recruiter_id = auth.uid() or public.is_admin_actor());

comment on table public.payment_orders is
  'Server-created Razorpay order intents. Client writes are intentionally blocked.';
comment on table public.payment_webhook_events is
  'Idempotency ledger for verified Razorpay webhook deliveries.';

notify pgrst, 'reload schema';

commit;
