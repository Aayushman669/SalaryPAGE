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
import {
  PricingAnalyticsIllustration,
  PricingCalculatorIllustration,
  PricingChecklistIllustration,
  PricingPlantIllustration,
  PricingTinyDecorations,
} from "./pricing-illustrations";

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
    <main className="pricing-page relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#FAF8FF_0%,#FFFFFF_36%,#FFFCF4_71%,#F7FBFF_100%)] px-5 pb-8 pt-7 text-[#0B1433] sm:px-8 lg:px-10">
      <StructuredData data={createPricingStructuredData(plans)} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-[-11rem] top-[44rem] h-72 w-80 rounded-[45%_55%_50%_45%] bg-[radial-gradient(ellipse_at_center,rgba(213,205,255,0.26),rgba(255,225,211,0.13)_56%,transparent_76%)] blur-3xl" />
        <div className="absolute right-[-10rem] top-[9rem] h-72 w-80 rounded-[45%_55%_50%_45%] bg-[radial-gradient(ellipse_at_center,rgba(255,225,211,0.22),rgba(255,238,229,0.12)_56%,transparent_76%)] blur-3xl" />
        <div className="absolute right-[-8rem] bottom-[-5rem] h-80 w-96 rounded-[45%_55%_50%_45%] bg-[radial-gradient(ellipse_at_center,rgba(255,223,209,0.28),rgba(224,218,255,0.12)_57%,transparent_77%)] blur-3xl" />
      </div>
      <PricingChecklistIllustration />
      <PricingAnalyticsIllustration />
      <PricingCalculatorIllustration />
      <PricingPlantIllustration />
      <PricingTinyDecorations />

      <section className="relative z-[5] mx-auto max-w-[1090px]">
        <div className="mx-auto max-w-[650px] text-center">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.16em] text-[#6447FF]">
            PRICING
          </p>
          <h1 className="mt-3 text-[42px] font-extrabold leading-[1.02] tracking-tight text-[#070D26] sm:text-[52px]">
            Simple plans for every
            <br />
            hiring stage
          </h1>
          <p className="mx-auto mt-5 max-w-[610px] text-[16px] font-medium leading-[1.5] text-[#343E79]">
            Choose the hiring capacity that fits your team, from focused job posts to advanced workflows and premium candidate visibility.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 text-[13px] font-bold">
            <span className="inline-flex h-[37px] min-w-[138px] items-center justify-center rounded-xl border border-[#DDD6FE] bg-white px-5 text-[#6759B7] shadow-[0_8px_20px_rgba(80,70,150,0.04)]">
              One-time access
            </span>
            <span className="inline-flex h-[37px] min-w-[138px] items-center justify-center rounded-xl border border-[#F1B600] bg-[#FFFDF4] px-5 text-[#B87900] shadow-[0_8px_20px_rgba(184,121,0,0.05)]">
              Built for scale
            </span>
            <span className="inline-flex h-[37px] min-w-[158px] items-center justify-center rounded-xl border border-[#DDD6FE] bg-white px-5 text-[#6759B7] shadow-[0_8px_20px_rgba(80,70,150,0.04)]">
              Lifetime plan access
            </span>
          </div>
        </div>

        <div className="mx-auto mt-5 max-w-[470px]">
          <label
            htmlFor="email"
            className="mb-2 block text-[13px] font-extrabold text-[#11172F]"
          >
            Email for payment access
          </label>
          <div className="relative">
            <svg aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A891FF]" fill="none" viewBox="0 0 24 24">
              <path d="M4 6.5h16v11H4z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
              <path d="m5 8 7 5 7-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
            </svg>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="h-[46px] w-full rounded-[9px] border border-[#DDE1EC] bg-white px-4 pl-12 text-[14px] font-medium text-[#0B1433] outline-none transition-colors duration-200 placeholder:text-[#8D96BB] focus:border-[#A891FF] focus:ring-4 focus:ring-[#DDD6FE]/45"
            />
          </div>
          {errorMessage ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="mt-6 grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-5 xl:gap-6">
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




