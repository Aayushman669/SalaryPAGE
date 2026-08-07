"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAuth } from "../auth-context";
import {
  loadRazorpayScript,
  type RazorpayPaymentResponse,
} from "../payments/razorpay-client";
import { notifyDashboardProfileChanged } from "../dashboard/use-dashboard-data";
import { plans, type PlanId } from "@/lib/plans";
import { canPurchasePlan, getSubscriptionSnapshot } from "@/lib/subscriptions";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/auth-profiles";
import { normalizeDashboardProfile } from "@/lib/dashboard-data";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import StructuredData from "@/app/structured-data";
import { createPricingStructuredData } from "@/lib/structured-data";
import { PricingCard, PricingTrustSection } from "./pricing-card";

export default function PricingPage() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const purchaseAttemptRef = useRef<{ plan: PlanId; key: string } | null>(null);

  function getPurchaseAttempt(plan: PlanId) {
    if (purchaseAttemptRef.current?.plan === plan) {
      return purchaseAttemptRef.current;
    }

    const key = crypto.randomUUID();
    const attempt = { plan, key };
    purchaseAttemptRef.current = attempt;
    return attempt;
  }

  function clearPurchaseAttempt() {
    purchaseAttemptRef.current = null;
  }

  async function recordPayment(payment: RazorpayPaymentResponse) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Supabase is not configured.");
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      throw new Error("Login is required to activate your plan.");
    }

    const response = await fetch("/api/verify-payment", {
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
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Payment could not be verified.");
    }

    const { data: userData } = await supabase.auth.getUser();

    if (userData.user) {
      const profileResult = await getProfile(userData.user.id);
      const normalizedProfile = normalizeDashboardProfile(
        profileResult.profile,
      );

      if (normalizedProfile) {
        notifyDashboardProfileChanged(normalizedProfile);
      }
    }
  }

  async function handleBuyNow(plan: PlanId) {
    setErrorMessage("");

    if (!isLoggedIn) {
      setIsLoginModalOpen(true);
      return;
    }

    setSelectedPlan(plan);
    const attempt = getPurchaseAttempt(plan);

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Supabase is not configured.");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please log in to continue.");
      }

      const { data: userData } = await supabase.auth.getUser();
      const subscriptionResult = await getSubscriptionSnapshot();

      if (subscriptionResult.error || !subscriptionResult.snapshot) {
        throw new Error(
          subscriptionResult.error ??
            "We could not verify your plan access. Please try again.",
        );
      }

      const purchaseAccess = canPurchasePlan(subscriptionResult.snapshot);

      if (!purchaseAccess.allowed) {
        throw new Error(
          purchaseAccess.reason === "not_recruiter"
            ? "Only Recruiter accounts can purchase hiring plans."
            : "This purchase is already being processed. Please wait a moment.",
        );
      }

      const checkoutEmail = userData.user?.email ?? email.trim();
      const checkoutName =
        typeof userData.user?.user_metadata?.full_name === "string"
          ? userData.user.user_metadata.full_name
          : "";
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error("Razorpay checkout could not be loaded.");
      }

      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan, idempotencyKey: attempt.key }),
      });

      const order = await response.json();

      if (!response.ok) {
        throw new Error(order.error || "Could not create payment order.");
      }

      const activePlan = plans.find((item) => item.id === plan);

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "JobForge",
        description: `${order.planName ?? activePlan?.name ?? "Job"} plan`,
        order_id: order.orderId,
        prefill: {
          name: order.prefill?.name ?? checkoutName,
          email: order.prefill?.email ?? checkoutEmail,
        },
        handler: async (paymentResponse: RazorpayPaymentResponse) => {
          try {
            await recordPayment(paymentResponse);
            clearPurchaseAttempt();
            setSelectedPlan(null);
            showSuccessToast(
              "Payment verified. Your subscription is active.",
            );
            router.push("/dashboard/billing?payment=success");
          } catch (error) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Payment could not be verified. Please try again.",
            );
            showErrorToast("Payment could not be verified. Please try again.");
            setSelectedPlan(null);
          }
        },
        modal: {
          ondismiss: () => {
            setSelectedPlan(null);
          },
        },
        theme: {
          color: "#020617",
        },
      });

      checkout.on("payment.failed", (response) => {
        setErrorMessage(
          response.error?.description || "Payment failed. Please try again.",
        );
        setSelectedPlan(null);
      });

      checkout.open();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while opening checkout.",
      );
      setSelectedPlan(null);
    }
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-gray-900 dark:bg-[#0f0f10] dark:text-gray-100 sm:px-8 lg:px-12">
      <StructuredData data={createPricingStructuredData(plans)} />
      <section className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Pricing
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-6xl">
            Simple plans for every hiring stage
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-gray-500 dark:text-gray-400 sm:text-lg">
            Choose the hiring capacity that fits your team, from focused job posts to advanced workflows and premium candidate visibility.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 text-sm font-medium text-gray-500 dark:text-gray-400">
            <span className="rounded-full border border-gray-200 bg-white px-4 py-2 shadow-[0_10px_24px_rgba(17,24,39,0.04)] dark:border-gray-700 dark:bg-[#171719]">
              One-time access
            </span>
            <span className="rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2 text-gray-900 dark:border-yellow-400/40 dark:bg-yellow-400/10 dark:text-gray-100">
              Built for recruiters
            </span>
            <span className="rounded-full border border-gray-200 bg-white px-4 py-2 shadow-[0_10px_24px_rgba(17,24,39,0.04)] dark:border-gray-700 dark:bg-[#171719]">
              Lifetime plan access
            </span>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-md">
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-100"
          >
            Email for payment access
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className="h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100 dark:border-gray-700 dark:bg-[#171719] dark:text-gray-100"
          />
          {errorMessage ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              isSelected={selectedPlan === plan.id}
              onSelect={handleBuyNow}
            />
          ))}
        </div>

        <PricingTrustSection />
      </section>

      {isLoginModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gray-900/30 px-4 py-6 backdrop-blur sm:px-6">
          <div className="relative max-h-[calc(100vh-3rem)] w-full max-w-md overflow-y-auto rounded-xl border border-gray-200 bg-white p-8 text-center shadow-[0_30px_90px_rgba(17,24,39,0.18)] dark:border-gray-700 dark:bg-[#171719]">
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold text-gray-500 transition-colors duration-200 hover:bg-yellow-50 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-yellow-100"
              aria-label="Close login modal"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Login Required
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              Login to continue and unlock your plan
            </p>
            <Link
              href="/login"
              className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl bg-black px-5 text-base font-semibold text-white transition-all duration-200 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_16px_34px_rgba(17,24,39,0.18)] focus:outline-none focus:ring-4 focus:ring-yellow-200 dark:bg-white dark:text-gray-950"
            >
              Login
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}




