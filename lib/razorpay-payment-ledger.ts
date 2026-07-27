import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logPaymentServerError } from "@/lib/api-auth";

export type PaymentOrderRow = {
  id: string;
  recruiter_id: string;
  plan_id: string;
  provider: "razorpay";
  provider_order_id: string | null;
  provider_payment_id: string | null;
  idempotency_key: string;
  amount: number | string;
  currency: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  created_at: string;
};

export type ActivatedSubscription = {
  subscription_id: string;
  plan_slug: string;
  subscription_status: string;
  starts_at: string;
  expires_at: string | null;
  purchased_at: string;
  remaining_jobs: number | null;
  remaining_featured_jobs: number | null;
};

export async function recordCapturedPayment({
  supabase,
  order,
  paymentId,
  amount,
  currency,
}: {
  supabase: SupabaseClient;
  order: PaymentOrderRow;
  paymentId: string;
  amount: number;
  currency: string;
}) {
  const { data, error } = await supabase.rpc(
    "activate_verified_razorpay_payment",
    {
      p_amount: amount / 100,
      p_currency: currency.trim(),
      p_payment_id: paymentId,
      p_payment_order_id: order.id,
    },
  );

  if (error) {
    logPaymentServerError("[razorpay] atomic subscription activation failed", error);
    return {
      ok: false,
      error: "Payment was verified, but subscription activation failed. Please try again.",
    } as const;
  }

  const activation = (Array.isArray(data) ? data[0] : data) as
    | ActivatedSubscription
    | null;

  if (!activation?.subscription_id) {
    return {
      ok: false,
      error: "Payment was verified, but subscription activation failed. Please try again.",
    } as const;
  }

  return {
    ok: true,
    duplicate: order.status === "paid" && order.provider_payment_id === paymentId,
    activation,
  } as const;
}

export async function recordFailedPayment({
  supabase,
  order,
  paymentId,
  amount,
  currency,
}: {
  supabase: SupabaseClient;
  order: PaymentOrderRow;
  paymentId: string;
  amount: number;
  currency: string;
}) {
  const { data, error } = await supabase.rpc(
    "record_failed_razorpay_payment",
    {
      p_amount: amount / 100,
      p_currency: currency.trim(),
      p_payment_id: paymentId,
      p_payment_order_id: order.id,
    },
  );

  if (error || data !== true) {
    logPaymentServerError(
      "[razorpay] atomic failed payment recording failed",
      error ?? new Error("Failed payment ledger update returned false."),
    );
    return false;
  }

  return true;
}
