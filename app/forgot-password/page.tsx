"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  CONNECTION_ERROR_MESSAGE,
  INVALID_EMAIL_MESSAGE,
  isNetworkError,
  isRateLimitError,
  isUnknownUserForReset,
  isValidEmail,
  logAuthError,
  PRIVACY_SAFE_RESET_SUCCESS_MESSAGE,
  TOO_MANY_ATTEMPTS_MESSAGE,
} from "@/lib/auth-errors";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

function getPasswordResetRedirectUrl() {
  const explicitRedirect = process.env.NEXT_PUBLIC_PASSWORD_RESET_REDIRECT_URL;

  if (explicitRedirect) {
    return explicitRedirect;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (siteUrl) {
    return `${siteUrl.replace(/\/$/, "")}/reset-password`;
  }

  return `${window.location.origin}/reset-password`;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setMessage("");
    setIsSuccess(false);

    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      setMessage(INVALID_EMAIL_MESSAGE);
      return;
    }

    if (!supabase) {
      const nextMessage = "Password reset is not available right now.";
      setMessage(nextMessage);
      showErrorToast(nextMessage);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        {
          redirectTo: getPasswordResetRedirectUrl(),
        },
      );

      setIsSubmitting(false);

      if (error) {
        logAuthError("[forgot-password] reset request failed", error);

        if (isUnknownUserForReset(error)) {
          setIsSuccess(true);
          setMessage(PRIVACY_SAFE_RESET_SUCCESS_MESSAGE);
          showSuccessToast("If an account exists, a reset link has been sent.");
          return;
        }

        if (isRateLimitError(error)) {
          setMessage(TOO_MANY_ATTEMPTS_MESSAGE);
          showErrorToast(TOO_MANY_ATTEMPTS_MESSAGE);
          return;
        }

        if (isNetworkError(error)) {
          setMessage(CONNECTION_ERROR_MESSAGE);
          showErrorToast("We could not connect. Please try again.");
          return;
        }

        const nextMessage = "We could not send a reset link. Please try again.";
        setMessage(nextMessage);
        showErrorToast(nextMessage);
        return;
      }
    } catch (error) {
      logAuthError("[forgot-password] reset network failure", error);
      setIsSubmitting(false);
      setMessage(CONNECTION_ERROR_MESSAGE);
      showErrorToast("We could not connect. Please try again.");
      return;
    }

    setIsSuccess(true);
    setMessage(PRIVACY_SAFE_RESET_SUCCESS_MESSAGE);
    showSuccessToast("If an account exists, a reset link has been sent.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-12 text-gray-900 sm:px-8">
      <section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-[#FEFEFC] p-7 shadow-[0_26px_75px_rgba(0,0,0,0.07)] sm:p-9">
        <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-yellow-400/20 blur-3xl" />

        <div className="relative text-center">
          <p className="inline-flex rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-900">
            Password reset
          </p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900">
            Forgot your password?
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-500">
            Enter your email address and we&apos;ll send you a password reset
            link.
          </p>
        </div>

        {isSuccess ? (
          <div className="relative mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-center">
            <p className="text-sm font-semibold leading-6 text-emerald-700">
              {message}
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            onChange={() => {
              setMessage("");
              setIsSuccess(false);
            }}
            noValidate
            className="relative mt-8 grid gap-5"
          >
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-900">
                Email Address
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                required
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl bg-black px-5 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_16px_34px_rgba(17,24,39,0.18)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        {message && !isSuccess ? (
          <p className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-center text-sm font-medium text-gray-900">
            {message}
          </p>
        ) : null}

        <p className="relative mt-7 text-center text-sm text-gray-500">
          Remembered your password?{" "}
          <Link
            href="/login"
            className="font-bold text-gray-900 underline decoration-yellow-500 decoration-2 underline-offset-4"
          >
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
