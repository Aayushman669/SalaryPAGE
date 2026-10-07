"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthLoading from "../auth-loading";
import {
  CONNECTION_ERROR_MESSAGE,
  getPasswordStrengthError,
  logAuthError,
  PASSWORDS_DO_NOT_MATCH_MESSAGE,
} from "@/lib/auth-errors";
import { enqueueClientEmailEvent } from "@/lib/email/client";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type ResetStatus = "checking" | "valid" | "invalid" | "success";

function hasRecoveryMarker() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(
    window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash,
  );
  const type = (searchParams.get("type") ?? hashParams.get("type"))?.toLowerCase();
  const hasRecoveryToken = Boolean(
    searchParams.get("code") ||
      searchParams.get("token_hash") ||
      hashParams.get("code") ||
      (hashParams.get("access_token") && hashParams.get("refresh_token")),
  );

  return (
    (type === "recovery" || type === "password_recovery") &&
    hasRecoveryToken
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [startedFromRecoveryLink] = useState(
    () => typeof window !== "undefined" && hasRecoveryMarker(),
  );
  const [status, setStatus] = useState<ResetStatus>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const client = supabase;

    if (!client) {
      const unavailableId = window.setTimeout(() => {
        setStatus("invalid");
      }, 0);

      return () => {
        window.clearTimeout(unavailableId);
      };
    }

    const timeoutId = window.setTimeout(async () => {
      const { data, error } = await client.auth.getSession();

      if (error) {
        logAuthError("[reset-password] session lookup failed", error);
      }

      setStatus(startedFromRecoveryLink && data.session ? "valid" : "invalid");
    }, 1000);

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && startedFromRecoveryLink && session) {
        window.clearTimeout(timeoutId);
        setStatus("valid");
      }
    });

    return () => {
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [startedFromRecoveryLink]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setMessage("");

    const passwordError = getPasswordStrengthError(newPassword);

    if (passwordError) {
      setMessage(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage(PASSWORDS_DO_NOT_MATCH_MESSAGE);
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
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        logAuthError("[reset-password] password update failed", error);

        setIsSubmitting(false);
        const nextMessage =
          "We could not update your password. Please request a new reset link and try again.";
        setMessage(nextMessage);
        showErrorToast(nextMessage);
        return;
      }

      void enqueueClientEmailEvent({ type: "password_reset" });

      const { error: signOutError } = await supabase.auth.signOut({
        scope: "global",
      });

      if (signOutError) {
        logAuthError("[reset-password] post-update sign out failed", signOutError);
      }
    } catch (error) {
      logAuthError("[reset-password] password update network failure", error);
      setIsSubmitting(false);
      setMessage(CONNECTION_ERROR_MESSAGE);
      showErrorToast("We could not connect. Please try again.");
      return;
    }

    setIsSubmitting(false);
    setStatus("success");
    setMessage("Your password has been updated successfully.");
    showSuccessToast("Password updated successfully.");

    window.setTimeout(() => {
      router.replace("/login");
    }, 1200);
  }

  if (status === "checking") {
    return <AuthLoading />;
  }

  if (status === "invalid") {
    return (
      <main className="ui-consistency-surface flex min-h-screen items-center justify-center bg-white px-5 py-12 text-gray-900 sm:px-8">
        <section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-[#FEFEFC] p-7 text-center shadow-[0_26px_75px_rgba(0,0,0,0.07)] sm:p-9">
          <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-yellow-400/20 blur-3xl" />
          <div className="relative">
            <p className="inline-flex rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-900">
              Reset link
            </p>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900">
              Link expired
            </h1>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              This password reset link is invalid or has expired.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="ui-consistency-surface flex min-h-screen items-center justify-center bg-white px-5 py-12 text-gray-900 sm:px-8">
      <section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-[#FEFEFC] p-7 shadow-[0_26px_75px_rgba(0,0,0,0.07)] sm:p-9">
        <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-yellow-400/20 blur-3xl" />

        <div className="relative text-center">
          <p className="inline-flex rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-900">
            Secure reset
          </p>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900">
            Reset your password
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-500">
            Create a new password for your JobForge account.
          </p>
        </div>

        {status === "success" ? (
          <div className="relative mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-center">
            <p className="text-sm font-semibold leading-6 text-emerald-700">
              {message}
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            onChange={() => setMessage("")}
            noValidate
            className="relative mt-8 grid gap-5"
          >
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-900">
                New Password
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter a new password"
                className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-900">
                Confirm Password
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm your new password"
                className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                required
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl bg-black px-5 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_16px_34px_rgba(17,24,39,0.18)] focus:outline-none focus:ring-4 focus:ring-yellow-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}

        {message && status !== "success" ? (
          <p className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-center text-sm font-medium text-gray-900">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
