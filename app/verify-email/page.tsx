"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getFriendlyResendError,
  INVALID_EMAIL_MESSAGE,
  isAlreadyVerifiedError,
  isValidEmail,
  logAuthError,
} from "@/lib/auth-errors";
import { getAuthCallbackUrl } from "@/lib/auth-redirects";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

const cooldownSeconds = 60;

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email") ?? "";
      const storedEmail = window.sessionStorage.getItem(
        "pending_verification_email",
      );
      const nextEmail = emailParam || storedEmail || "";
      const errorParam = params.get("error");

      setEmail(nextEmail);

      if (nextEmail) {
        window.sessionStorage.setItem("pending_verification_email", nextEmail);
      }

      if (errorParam === "invalid") {
        setIsSuccess(false);
        setMessage(
          "This verification link is invalid or has expired. Please request a new email.",
        );
      } else if (errorParam === "profile") {
        setIsSuccess(false);
        setMessage(
          "Your email was verified, but we could not load your profile. Please log in and try again.",
        );
      }
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCooldown((currentCooldown) => Math.max(currentCooldown - 1, 0));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cooldown]);

  async function handleResend() {
    if (isSending || cooldown > 0) {
      return;
    }

    const trimmedEmail = email.trim();
    setMessage("");
    setIsSuccess(false);

    if (!isValidEmail(trimmedEmail)) {
      setMessage(INVALID_EMAIL_MESSAGE);
      return;
    }

    if (!supabase) {
      const nextMessage = "Email verification is not available right now.";
      setMessage(nextMessage);
      showErrorToast(nextMessage);
      return;
    }

    setIsSending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
        options: {
          emailRedirectTo: getAuthCallbackUrl(),
        },
      });

      setIsSending(false);

      if (error) {
        logAuthError("[verify-email] resend failed", error);
        setIsSuccess(isAlreadyVerifiedError(error));
        const nextMessage = getFriendlyResendError(error);
        setMessage(nextMessage);
        if (isAlreadyVerifiedError(error)) {
          showSuccessToast(nextMessage);
        } else {
          showErrorToast(nextMessage);
        }
        return;
      }
    } catch (error) {
      logAuthError("[verify-email] resend network failure", error);
      setIsSending(false);
      const nextMessage = getFriendlyResendError(error);
      setMessage(nextMessage);
      showErrorToast(nextMessage);
      return;
    }

    window.sessionStorage.setItem("pending_verification_email", trimmedEmail);
    setIsSuccess(true);
    setCooldown(cooldownSeconds);
    setMessage("Verification email sent successfully.");
    showSuccessToast("Verification email sent.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-12 text-gray-900 sm:px-8">
      <section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-[#FEFEFC] p-7 text-center shadow-[0_26px_75px_rgba(0,0,0,0.07)] sm:p-9">
        <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-yellow-400/20 blur-3xl" />

        <div className="relative">
          <p className="inline-flex rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-900">
            Email confirmation
          </p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900">
            Verify your email
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-500">
            We sent a verification link to your email address.
          </p>

          {email ? (
            <p className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-semibold text-gray-900">
              {email}
            </p>
          ) : (
            <label className="mt-5 grid gap-2 text-left">
              <span className="text-sm font-semibold text-gray-900">
                Email Address
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setMessage("");
                  setIsSuccess(false);
                }}
                placeholder="you@company.com"
                className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              />
            </label>
          )}

          <p className="mt-5 text-sm leading-6 text-gray-500">
            Open the email and click the verification link to continue.
          </p>

          <div className="mt-8 grid gap-3">
            <button
              type="button"
              onClick={handleResend}
              disabled={isSending || cooldown > 0}
              className="h-12 w-full rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_16px_34px_rgba(17,24,39,0.18)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSending
                ? "Sending..."
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Resend verification email"}
            </button>
            <Link
              href="/login"
              className="flex h-12 w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-900 transition-all duration-200 hover:-translate-y-0.5 hover:border-yellow-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-yellow-100"
            >
              Back to Login
            </Link>
          </div>

          {message ? (
            <p
              className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                isSuccess
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-yellow-200 bg-yellow-50 text-gray-900"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
