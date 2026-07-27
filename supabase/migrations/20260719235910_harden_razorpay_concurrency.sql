begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

-- A short-lived claim serializes provider-order creation across browser tabs
-- and across multiple application instances. The claim is stored as a hash so
-- the coordination token is never persisted in plaintext.
alter table public.payment_orders
  add column if not exists creation_claim_hash text,
  add column if not exists creation_claimed_at timestamptz;

create index if not exists payment_orders_creation_claim_idx
  on public.payment_orders (creation_claimed_at)
  where creation_claim_hash is not null;

create or replace function public.claim_razorpay_order_creation(
  p_payment_order_id uuid,
  p_claim_token text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.payment_orders%rowtype;
  v_claim_hash text;
begin
  if p_payment_order_id is null
     or p_claim_token is null
     or char_length(p_claim_token) not between 16 and 128 then
    return false;
  end if;

  v_claim_hash := md5(p_claim_token);

  select *
  into v_order
  from public.payment_orders
  where payment_orders.id = p_payment_order_id
    and payment_orders.provider = 'razorpay'
  for update;

  if not found
     or v_order.status <> 'pending'
     or v_order.provider_order_id is not null then
    return false;
  end if;

  if v_order.creation_claim_hash is not null
     and v_order.creation_claimed_at > now() - interval '2 minutes' then
    return false;
  end if;

  update public.payment_orders
  set
    creation_claim_hash = v_claim_hash,
    creation_claimed_at = now(),
    updated_at = now()
  where payment_orders.id = v_order.id;

  return true;
end;
$$;

create or replace function public.release_razorpay_order_creation(
  p_payment_order_id uuid,
  p_claim_token text,
  p_provider_order_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.payment_orders%rowtype;
  v_claim_hash text;
begin
  if p_payment_order_id is null
     or p_claim_token is null
     or char_length(p_claim_token) not between 16 and 128 then
    return false;
  end if;

  v_claim_hash := md5(p_claim_token);

  select *
  into v_order
  from public.payment_orders
  where payment_orders.id = p_payment_order_id
  for update;

  if not found
     or v_order.creation_claim_hash is distinct from v_claim_hash
     or v_order.status <> 'pending' then
    return false;
  end if;

  if p_provider_order_id is not null
     and char_length(trim(p_provider_order_id)) = 0 then
    return false;
  end if;

  if v_order.provider_order_id is not null
     and p_provider_order_id is not null
     and v_order.provider_order_id <> p_provider_order_id then
    return false;
  end if;

  update public.payment_orders
  set
    provider_order_id = coalesce(v_order.provider_order_id, nullif(trim(p_provider_order_id), '')),
    creation_claim_hash = null,
    creation_claimed_at = null,
    updated_at = now()
  where payment_orders.id = v_order.id;

  return true;
end;
$$;

-- Webhook delivery retries must claim the event while holding a row lock.
-- This closes the gap where two retries with the same event id both observed
-- a failed or processing row and started work concurrently.
create or replace function public.claim_razorpay_webhook_event(
  p_provider_event_id text,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.payment_webhook_events%rowtype;
  v_inserted_id uuid;
begin
  if p_provider_event_id is null
     or char_length(p_provider_event_id) not between 1 and 200
     or p_event_type is null
     or char_length(p_event_type) not between 1 and 120 then
    return false;
  end if;

  insert into public.payment_webhook_events (
    provider,
    provider_event_id,
    event_type,
    status
  )
  values (
    'razorpay',
    p_provider_event_id,
    p_event_type,
    'processing'
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is not null then
    return true;
  end if;

  select *
  into v_event
  from public.payment_webhook_events
  where provider = 'razorpay'
    and provider_event_id = p_provider_event_id
  for update;

  if not found
     or v_event.status = 'processed'
     or (
       v_event.status = 'processing'
       and v_event.updated_at > now() - interval '5 minutes'
     ) then
    return false;
  end if;

  update public.payment_webhook_events
  set
    status = 'processing',
    event_type = p_event_type,
    processed_at = null,
    updated_at = now()
  where id = v_event.id;

  return true;
end;
$$;

-- A failed webhook must lock the same payment order as the capture path. A
-- late failure can therefore never overwrite an already activated payment.
create or replace function public.record_failed_razorpay_payment(
  p_payment_order_id uuid,
  p_payment_id text,
  p_amount numeric,
  p_currency text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.payment_orders%rowtype;
  v_purchase public.purchase_history%rowtype;
begin
  select *
  into v_order
  from public.payment_orders
  where payment_orders.id = p_payment_order_id
    and payment_orders.provider = 'razorpay'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Payment order was not found.';
  end if;

  if p_payment_id is null or char_length(trim(p_payment_id)) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Payment reference is missing.';
  end if;

  if v_order.provider_payment_id is not null
     and v_order.provider_payment_id <> p_payment_id then
    raise exception using
      errcode = 'P0001',
      message = 'Payment order is linked to another payment.';
  end if;

  if v_order.status = 'paid' then
    return true;
  end if;

  if v_order.amount <> p_amount
     or trim(v_order.currency) <> trim(p_currency) then
    raise exception using
      errcode = 'P0001',
      message = 'Payment amount or currency does not match the order.';
  end if;

  select *
  into v_purchase
  from public.purchase_history
  where purchase_history.payment_provider = 'razorpay'
    and purchase_history.provider_payment_id = p_payment_id
  for update;

  if found then
    if v_purchase.recruiter_id <> v_order.recruiter_id
       or v_purchase.plan_id <> v_order.plan_id
       or v_purchase.amount <> v_order.amount
       or trim(v_purchase.currency) <> trim(v_order.currency)
       or v_purchase.provider_order_id is distinct from v_order.provider_order_id then
      raise exception using
        errcode = 'P0001',
        message = 'Payment ownership or order details do not match.';
    end if;

    if v_purchase.status = 'paid' then
      update public.payment_orders
      set
        provider_payment_id = p_payment_id,
        status = 'paid',
        updated_at = now()
      where payment_orders.id = v_order.id;
      return true;
    end if;

    if v_purchase.status in ('refunded', 'partially_refunded') then
      return true;
    end if;

    update public.purchase_history
    set status = 'failed'
    where public.purchase_history.id = v_purchase.id;
  else
    insert into public.purchase_history (
      recruiter_id,
      plan_id,
      amount,
      currency,
      payment_provider,
      payment_reference,
      provider_order_id,
      provider_payment_id,
      status,
      purchased_at,
      metadata
    )
    values (
      v_order.recruiter_id,
      v_order.plan_id,
      v_order.amount,
      trim(v_order.currency),
      'razorpay',
      p_payment_id,
      v_order.provider_order_id,
      p_payment_id,
      'failed',
      now(),
      jsonb_build_object('order_id', v_order.provider_order_id)
    );
  end if;

  update public.payment_orders
  set
    provider_payment_id = p_payment_id,
    status = 'failed',
    updated_at = now()
  where public.payment_orders.id = v_order.id;

  return true;
end;
$$;

-- Keep the original activation implementation as a private implementation
-- detail, then add an invariant check in front of it. This prevents a second
-- payment reference from activating an order already associated with another
-- failed or captured payment.
do $$
begin
  if to_regprocedure('public.activate_verified_razorpay_payment(uuid,text,numeric,text)') is not null
     and to_regprocedure('public.activate_verified_razorpay_payment_legacy(uuid,text,numeric,text)') is null then
    alter function public.activate_verified_razorpay_payment(uuid, text, numeric, text)
      rename to activate_verified_razorpay_payment_legacy;
  end if;
end;
$$;

create or replace function public.activate_verified_razorpay_payment(
  p_payment_order_id uuid,
  p_payment_id text,
  p_amount numeric,
  p_currency text
)
returns table (
  subscription_id uuid,
  plan_slug text,
  subscription_status text,
  starts_at timestamptz,
  expires_at timestamptz,
  purchased_at timestamptz,
  remaining_jobs integer,
  remaining_featured_jobs integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider_payment_id text;
begin
  select payment_orders.provider_payment_id
  into v_provider_payment_id
  from public.payment_orders
  where payment_orders.id = p_payment_order_id
    and payment_orders.provider = 'razorpay'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Verified payment order was not found.';
  end if;

  if v_provider_payment_id is not null
     and v_provider_payment_id <> p_payment_id then
    raise exception using
      errcode = 'P0001',
      message = 'Payment order is linked to another payment.';
  end if;

  return query
  select *
  from public.activate_verified_razorpay_payment_legacy(
    p_payment_order_id,
    p_payment_id,
    p_amount,
    p_currency
  );
end;
$$;

revoke all on function public.claim_razorpay_order_creation(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_razorpay_order_creation(uuid, text)
  to service_role;

revoke all on function public.release_razorpay_order_creation(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.release_razorpay_order_creation(uuid, text, text)
  to service_role;

revoke all on function public.claim_razorpay_webhook_event(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_razorpay_webhook_event(text, text)
  to service_role;

revoke all on function public.record_failed_razorpay_payment(uuid, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.record_failed_razorpay_payment(uuid, text, numeric, text)
  to service_role;

revoke all on function public.activate_verified_razorpay_payment_legacy(uuid, text, numeric, text)
  from public, anon, authenticated, service_role;
revoke all on function public.activate_verified_razorpay_payment(uuid, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.activate_verified_razorpay_payment(uuid, text, numeric, text)
  to service_role;

comment on function public.claim_razorpay_order_creation(uuid, text) is
  'Server-only short-lived claim that serializes Razorpay order creation for one payment intent.';
comment on function public.claim_razorpay_webhook_event(text, text) is
  'Server-only atomic claim for idempotent Razorpay webhook delivery processing.';
comment on function public.record_failed_razorpay_payment(uuid, text, numeric, text) is
  'Server-only atomic failure ledger update that cannot overwrite an activated payment.';
comment on function public.activate_verified_razorpay_payment(uuid, text, numeric, text) is
  'Server-only verified payment activation with an order-payment identity invariant and atomic subscription replacement.';

notify pgrst, 'reload schema';

commit;
