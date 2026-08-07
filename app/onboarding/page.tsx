"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthLoading from "../auth-loading";
import { ensureProfile } from "@/lib/auth-profiles";
import {
  CONNECTION_ERROR_MESSAGE,
  isNetworkError,
  logAuthError,
} from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

const onboardingOptions = [
  {
    id: "recruiter",
    title: "I'm Hiring",
    description: "Post jobs, manage applicants, and hire talent.",
  },
  {
    id: "job_seeker",
    title: "I'm Looking for a Job",
    description: "Discover opportunities, save jobs, and apply easily.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      router.push("/login");
      return;
    }

    const client = supabase;

    client.auth.getUser().then(async ({ data, error }) => {
      if (error) {
        logAuthError("[onboarding] auth user lookup failed", error);
        router.push("/login");
        return;
      }

      if (!data.user) {
        router.push("/login");
        return;
      }

      const profileCreationError = await ensureProfile({
        email: data.user.email ?? "",
        fullName:
          typeof data.user.user_metadata?.full_name === "string"
            ? data.user.user_metadata.full_name
            : "",
        userId: data.user.id,
      });

      if (profileCreationError) {
        const nextMessage =
          profileCreationError === CONNECTION_ERROR_MESSAGE
            ? CONNECTION_ERROR_MESSAGE
            : "We could not prepare your profile. Please try again.";
        setErrorMessage(nextMessage);
        showErrorToast(nextMessage);
        setIsCheckingAuth(false);
        return;
      }

      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("profile_completed")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        logAuthError("[onboarding] profile lookup failed", profileError);
        const nextMessage = "We could not load your profile. Please try again.";
        setErrorMessage(nextMessage);
        showErrorToast(nextMessage);
        setIsCheckingAuth(false);
        return;
      }

      if (profile?.profile_completed) {
        router.push("/dashboard");
        return;
      }

      setIsCheckingAuth(false);
    }).catch((error: unknown) => {
      logAuthError("[onboarding] auth check network failure", error);
      setErrorMessage(CONNECTION_ERROR_MESSAGE);
      showErrorToast("We could not connect. Please try again.");
      setIsCheckingAuth(false);
    });
  }, [router]);

  async function handleContinue() {
    if (isSubmitting) {
      return;
    }

    if (!selectedOption) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    if (!supabase) {
      setIsSubmitting(false);
      setErrorMessage("Please log in to continue.");
      showErrorToast("Please log in to continue.");
      router.push("/login");
      return;
    }

    const client = supabase;

    try {
      const { data: userData, error: userError } = await client.auth.getUser();

      if (userError) {
        logAuthError("[onboarding] current auth user lookup failed", userError);
      }

      if (userError || !userData.user) {
        setIsSubmitting(false);
        setErrorMessage("Please log in to continue.");
        showErrorToast("Please log in to continue.");
        router.push("/login");
        return;
      }

      const profileCreationError = await ensureProfile({
        email: userData.user.email ?? "",
        fullName:
          typeof userData.user.user_metadata?.full_name === "string"
            ? userData.user.user_metadata.full_name
            : "",
        userId: userData.user.id,
      });

      if (profileCreationError) {
        setIsSubmitting(false);
        const nextMessage =
          profileCreationError === CONNECTION_ERROR_MESSAGE
            ? CONNECTION_ERROR_MESSAGE
            : "We could not prepare your profile. Please try again.";
        setErrorMessage(nextMessage);
        showErrorToast(nextMessage);
        return;
      }

      const profileResponse = await client
        .from("profiles")
        .select("id")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (profileResponse.error) {
        logAuthError("[onboarding] profile lookup failed", profileResponse.error);
        setIsSubmitting(false);
        const nextMessage =
          isNetworkError(profileResponse.error)
            ? CONNECTION_ERROR_MESSAGE
            : "We could not load your profile. Please try again.";
        setErrorMessage(nextMessage);
        showErrorToast(nextMessage);
        return;
      }

      if (!profileResponse.data) {
        setIsSubmitting(false);
        const nextMessage =
          "We could not find your profile. Please sign in again and try once more.";
        setErrorMessage(nextMessage);
        showErrorToast(nextMessage);
        return;
      }

      const updatePayload = {
        role_mode: selectedOption,
        profile_completed: true,
      };

      const updateResponse = await client
        .from("profiles")
        .update(updatePayload)
        .eq("id", userData.user.id);

      setIsSubmitting(false);

      if (updateResponse.error) {
        logAuthError("[onboarding] profile update failed", updateResponse.error);
        const nextMessage =
          isNetworkError(updateResponse.error)
            ? CONNECTION_ERROR_MESSAGE
            : "We could not save your choice. Please try again.";
        setErrorMessage(nextMessage);
        showErrorToast(nextMessage);
        return;
      }

      showSuccessToast("Profile setup completed.");
      router.push("/dashboard");
    } catch (error) {
      logAuthError("[onboarding] profile save network failure", error);
      setIsSubmitting(false);
      setErrorMessage(CONNECTION_ERROR_MESSAGE);
      showErrorToast("We could not connect. Please try again.");
    }
  }

  if (isCheckingAuth) {
    return <AuthLoading />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12 text-gray-900 sm:px-8 lg:px-12">
      <section className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-gray-200 bg-[#FEFEFC] p-8 text-center shadow-[0_26px_75px_rgba(0,0,0,0.07)] sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-yellow-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-2xl">
          <p className="inline-flex rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-900">
            Onboarding
          </p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            What brings you here?
          </h1>
          <p className="mt-3 text-base leading-7 text-gray-500">
            Choose how you want to use JobForge.
          </p>
        </div>

        <div className="relative mt-10 grid gap-5 md:grid-cols-2">
          {onboardingOptions.map((option) => {
            const isSelected = selectedOption === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setSelectedOption(option.id);
                  setErrorMessage("");
                }}
                className={`rounded-2xl border bg-white p-6 text-left shadow-[0_18px_45px_rgba(17,24,39,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(17,24,39,0.10)] focus:outline-none focus:ring-4 focus:ring-yellow-100 ${
                  isSelected
                    ? "border-yellow-500 ring-4 ring-yellow-100"
                    : "border-gray-200"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black ${
                    isSelected
                      ? "bg-yellow-500 text-gray-900"
                      : "bg-gray-900 text-white"
                  }`}
                >
                  {option.title.charAt(4)}
                </span>
                <h2 className="mt-5 text-xl font-bold tracking-tight text-gray-900">
                  {option.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-gray-500">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={!selectedOption || isSubmitting}
          className="relative mt-10 inline-flex h-12 w-full items-center justify-center rounded-xl bg-black px-6 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_16px_34px_rgba(17,24,39,0.18)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:hover:translate-y-0 sm:w-auto"
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </button>

        {errorMessage ? (
          <p className="relative mt-4 text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        ) : null}
      </section>
    </main>
  );
}
