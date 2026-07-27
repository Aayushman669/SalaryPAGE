begin;

set local search_path = public, extensions, pg_catalog, pg_temp;

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
  v_now timestamptz := now();
  v_order public.payment_orders%rowtype;
  v_plan public.plans%rowtype;
  v_purchase public.purchase_history%rowtype;
  v_current public.subscriptions%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_usage public.plan_usage%rowtype;
  v_status text;
  v_expires_at timestamptz;
  v_jobs_posted integer := 0;
  v_featured_jobs_used integer := 0;
  v_remaining_jobs integer;
  v_remaining_featured_jobs integer;
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
      message = 'Verified payment order was not found.';
  end if;

  if v_order.provider_order_id is null
     or (
       v_order.provider_payment_id is not null
       and v_order.provider_payment_id <> p_payment_id
       and v_order.status = 'paid'
     ) then
    raise exception using
      errcode = 'P0001',
      message = 'Payment order has already been completed.';
  end if;

  select *
  into v_plan
  from public.plans
  where plans.id = v_order.plan_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'The purchased plan is no longer available.';
  end if;

  if v_order.amount <> v_plan.price
     or trim(v_order.currency) <> trim(v_plan.currency)
     or p_amount <> v_plan.price
     or trim(p_currency) <> trim(v_plan.currency) then
    raise exception using
      errcode = 'P0001',
      message = 'Payment amount or currency does not match the plan.';
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
       or v_purchase.amount <> v_plan.price
       or trim(v_purchase.currency) <> trim(v_plan.currency) then
      raise exception using
        errcode = 'P0001',
        message = 'Payment ownership or plan details do not match.';
    end if;

    if v_purchase.status in ('refunded', 'partially_refunded') then
      raise exception using
        errcode = 'P0001',
        message = 'A refunded payment cannot activate a subscription.';
    end if;
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
      v_plan.price,
      trim(v_plan.currency),
      'razorpay',
      p_payment_id,
      v_order.provider_order_id,
      p_payment_id,
      'paid',
      v_now,
      jsonb_build_object('order_id', v_order.provider_order_id)
    )
    returning * into v_purchase;
  end if;

  -- Usage is materialized, but an upgrade or replacement must preserve the
  -- recruiter's existing slot-consuming jobs instead of resetting to zero.
  select count(*)::integer
  into v_jobs_posted
  from public.jobs
  where jobs.created_by = v_order.recruiter_id
    and jobs.status in ('published', 'pending');

  select count(*)::integer
  into v_featured_jobs_used
  from public.jobs
  where jobs.created_by = v_order.recruiter_id
    and jobs.status = 'published'
    and jobs.featured = true;

  v_remaining_jobs := case
    when v_plan.job_post_limit is null then null
    else greatest(v_plan.job_post_limit - v_jobs_posted, 0)
  end;

  v_remaining_featured_jobs := case
    when v_plan.featured_job_limit is null then null
    else greatest(v_plan.featured_job_limit - v_featured_jobs_used, 0)
  end;

  if v_purchase.status <> 'paid' then
    update public.purchase_history
    set
      status = 'paid',
      payment_reference = p_payment_id,
      provider_order_id = v_order.provider_order_id,
      provider_payment_id = p_payment_id,
      purchased_at = v_now
    where public.purchase_history.id = v_purchase.id;

    select *
    into v_purchase
    from public.purchase_history
    where public.purchase_history.id = v_purchase.id
    for update;
  end if;

  if v_purchase.subscription_id is not null then
    select *
    into v_subscription
    from public.subscriptions
    where public.subscriptions.id = v_purchase.subscription_id
      and public.subscriptions.recruiter_id = v_order.recruiter_id
    for update;

    if found and v_subscription.status in ('active', 'lifetime') then
      select *
      into v_usage
      from public.plan_usage
      where public.plan_usage.subscription_id = v_subscription.id
      order by public.plan_usage.period_start desc, public.plan_usage.id desc
      limit 1;

      if not found then
        insert into public.plan_usage (
          recruiter_id,
          subscription_id,
          plan_id,
          period_start,
          period_end,
          jobs_posted,
          featured_jobs_used,
          remaining_jobs
        )
        values (
          v_order.recruiter_id,
          v_subscription.id,
          v_plan.id,
          coalesce(v_subscription.starts_at, v_now),
          v_subscription.expires_at,
          v_jobs_posted,
          v_featured_jobs_used,
          v_remaining_jobs
        )
        returning * into v_usage;
      end if;

      update public.payment_orders
      set
        provider_payment_id = p_payment_id,
        status = 'paid'
      where public.payment_orders.id = v_order.id;

      return query
      select
        v_subscription.id,
        v_plan.slug,
        v_subscription.status,
        v_subscription.starts_at,
        v_subscription.expires_at,
        v_subscription.purchased_at,
        v_usage.remaining_jobs,
        case
          when v_plan.featured_job_limit is null then null
          else greatest(v_plan.featured_job_limit - v_usage.featured_jobs_used, 0)
        end
      ;
      return;
    end if;

    if found then
      raise exception using
        errcode = 'P0001',
        message = 'Payment is already linked to a completed subscription.';
    end if;
  end if;

  select *
  into v_current
  from public.subscriptions
  where public.subscriptions.recruiter_id = v_order.recruiter_id
    and public.subscriptions.status in ('active', 'lifetime')
  order by public.subscriptions.purchased_at desc nulls last,
           public.subscriptions.created_at desc,
           public.subscriptions.id desc
  limit 1
  for update;

  if found then
    update public.plan_usage
    set
      period_end = coalesce(period_end, v_now),
      updated_at = v_now
    where public.plan_usage.subscription_id = v_current.id
      and public.plan_usage.period_end is null;

    update public.subscriptions
    set
      status = 'cancelled',
      expires_at = greatest(coalesce(expires_at, starts_at, v_now), v_now),
      updated_at = v_now
    where public.subscriptions.id = v_current.id;
  end if;

  if v_plan.billing_type in ('lifetime', 'one_time')
     or (v_plan.billing_type = 'enterprise' and v_plan.duration_days is null) then
    v_status := 'lifetime';
    v_expires_at := null;
  else
    if v_plan.duration_days is null then
      raise exception using
        errcode = 'P0001',
        message = 'The plan duration is not configured.';
    end if;

    v_status := 'active';
    v_expires_at := v_now + make_interval(days => v_plan.duration_days);
  end if;

  insert into public.subscriptions (
    recruiter_id,
    plan_id,
    payment_id,
    status,
    starts_at,
    expires_at,
    purchased_at
  )
  values (
    v_order.recruiter_id,
    v_plan.id,
    p_payment_id,
    v_status,
    v_now,
    v_expires_at,
    coalesce(v_purchase.purchased_at, v_now)
  )
  returning * into v_subscription;

  insert into public.plan_usage (
    recruiter_id,
    subscription_id,
    plan_id,
    period_start,
    period_end,
    jobs_posted,
    featured_jobs_used,
    remaining_jobs
  )
  values (
    v_order.recruiter_id,
    v_subscription.id,
    v_plan.id,
    v_now,
    v_expires_at,
    v_jobs_posted,
    v_featured_jobs_used,
    v_remaining_jobs
  )
  returning * into v_usage;

  update public.purchase_history
  set subscription_id = v_subscription.id
  where public.purchase_history.id = v_purchase.id;

  update public.payment_orders
  set
    provider_payment_id = p_payment_id,
    status = 'paid'
  where public.payment_orders.id = v_order.id;

  update public.profiles
  set current_plan = v_plan.slug
  where public.profiles.id = v_order.recruiter_id
    and public.profiles.role_mode = 'recruiter';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Recruiter profile was not found.';
  end if;

  return query
  select
    v_subscription.id,
    v_plan.slug,
    v_subscription.status,
    v_subscription.starts_at,
    v_subscription.expires_at,
    v_subscription.purchased_at,
    v_usage.remaining_jobs,
    v_remaining_featured_jobs;
end;
$$;

revoke all on function public.activate_verified_razorpay_payment(uuid, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.activate_verified_razorpay_payment(uuid, text, numeric, text)
  to service_role;

comment on function public.activate_verified_razorpay_payment(uuid, text, numeric, text) is
  'Atomically activates a payment already verified by the trusted Razorpay server flow, replaces the previous active subscription, resets usage, and updates the recruiter profile.';

notify pgrst, 'reload schema';

commit;
