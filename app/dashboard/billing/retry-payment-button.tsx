"use client";

import { useState } from "react";
import {
  loadRazorpayScript,
  type RazorpayPaymentResponse,
} from "@/app/payments/razorpay-client";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

export default function RetryPaymentButton({
  onComplete,
  planSlug,
}: {
  onComplete: () => void;
  planSlug: string;
}) {
  const [isRetrying, setIsRetrying] = useState(false);

  async function handleRetry() {
    if (isRetrying || !supabase) {
      return;
    }

    setIsRetrying(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please log in again to retry this payment.");
      }

      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Razorpay checkout could not be loaded.");
      }

      const orderResponse = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          plan: planSlug,
        }),
      });
      const order = (await orderResponse.json()) as {
        amount?: number;
        currency?: string;
        error?: string;
        keyId?: string;
        orderId?: string;
        planName?: string;
        prefill?: { email?: string; name?: string };
      };

      if (!orderResponse.ok || !order.orderId || !order.keyId) {
        throw new Error(order.error ?? "Could not prepare a new payment.");
      }

      const checkout = new window.Razorpay({
        amount: order.amount,
        currency: order.currency,
        description: `${order.planName ?? "Plan"} plan retry`,
        handler: async (payment: RazorpayPaymentResponse) => {
          try {
            const verificationResponse = await fetch("/api/verify-payment", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                orderId: payment.razorpay_order_id,
                paymentId: payment.razorpay_payment_id,
                signature: payment.razorpay_signature,
              }),
            });
            const verification = (await verificationResponse.json()) as {
              error?: string;
            };

            if (!verificationResponse.ok) {
              throw new Error(
                verification.error ?? "Payment could not be verified.",
              );
            }

            showSuccessToast("Payment verified. Your subscription is active.");
            onComplete();
          } catch (error) {
            showErrorToast(
              error instanceof Error
                ? error.message
                : "Payment could not be verified. Please try again.",
            );
          } finally {
            setIsRetrying(false);
          }
        },
        key: order.keyId,
        modal: {
          ondismiss: () => {
            setIsRetrying(false);
          },
        },
        name: "JobForge",
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: "#020617" },
      });

      checkout.on("payment.failed", (response) => {
        showErrorToast(
          response.error?.description ?? "Payment failed. Please try again.",
        );
        setIsRetrying(false);
      });
      checkout.open();
    } catch (error) {
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Payment retry is temporarily unavailable.",
      );
      setIsRetrying(false);
    }
  }

  return (
    <button
      type="button"
      disabled={isRetrying}
      onClick={() => void handleRetry()}
      className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-900 transition-all duration-200 hover:border-yellow-300 hover:bg-yellow-50/60 focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isRetrying ? "Opening..." : "Retry Payment"}
    </button>
  );
}
