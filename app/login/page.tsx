"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import AuthLoading from "../auth-loading";
import { useAuth } from "../auth-context";
import { INVALID_EMAIL_MESSAGE, isValidEmail } from "@/lib/auth-errors";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

function AuthVisualPanel() {
  return (
    <section className="relative hidden overflow-hidden rounded-3xl border border-gray-200 bg-[#FFF7D6] p-10 shadow-[0_26px_75px_rgba(0,0,0,0.07)] lg:flex lg:flex-col lg:justify-between">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-yellow-400/30 blur-3xl" />
      <div className="relative">
        <p className="inline-flex rounded-full border border-yellow-500/30 bg-white/50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-900">
          Job Board
        </p>
        <h2 className="mt-6 max-w-sm text-4xl font-bold tracking-tight text-gray-900">
          Find your next opportunity.
        </h2>
        <p className="mt-4 max-w-sm text-base leading-7 text-gray-600">
          Join professionals and companies building the future.
        </p>
      </div>
      <div className="relative grid gap-3">
        {["Role-based dashboards", "Secure applications", "Recruiter tools"].map(
          (stat) => (
            <div
              key={stat}
              className="rounded-2xl border border-yellow-500/20 bg-white/60 px-5 py-4 text-sm font-bold text-gray-900 shadow-[0_12px_30px_rgba(120,75,12,0.08)]"
            >
              {stat}
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function getIntendedPath() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("next");
}

export default function LoginPage() {
  const router = useRouter();
  const {
    getCurrentRedirectPath,
    isAuthLoading,
    isLoggedIn,
    login,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && isLoggedIn) {
      getCurrentRedirectPath().then((path) => router.replace(path));
    }
  }, [getCurrentRedirectPath, isAuthLoading, isLoggedIn, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setMessage("");
    setUnverifiedEmail("");

    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      setMessage(INVALID_EMAIL_MESSAGE);
      return;
    }

    setIsSubmitting(true);

    const result = await login(trimmedEmail, password, getIntendedPath());

    if (result.error) {
      setMessage(result.error);
      setUnverifiedEmail(result.resendEmail ?? "");
      showErrorToast(result.error);
      setIsSubmitting(false);
      return;
    }

    showSuccessToast("Welcome back.");
    setIsSubmitting(false);
  }

  if (isAuthLoading || isLoggedIn) {
    return <AuthLoading />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-12 text-gray-900 sm:px-8 lg:px-12">
      <div className="grid w-full max-w-5xl items-stretch gap-8 lg:grid-cols-[1fr_440px]">
        <AuthVisualPanel />

        <section className="relative w-full overflow-hidden rounded-3xl border border-gray-200 bg-[#FEFEFC] p-7 shadow-[0_26px_75px_rgba(0,0,0,0.07)] sm:p-9">
          <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-yellow-400/20 blur-3xl" />

          <div className="relative text-center">
            <p className="inline-flex rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-gray-900">
              Secure access
            </p>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900">
              Welcome Back
            </h1>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              Sign in to continue to your Job Board account.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            onChange={() => {
              setMessage("");
              setUnverifiedEmail("");
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
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-gray-900">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-400 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                required
              />
            </label>
            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-gray-600 transition-colors duration-200 hover:text-gray-900"
              >
                Forgot Password?
              </Link>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl bg-black px-5 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.16),0_16px_34px_rgba(17,24,39,0.18)] focus:outline-none focus:ring-4 focus:ring-yellow-200"
            >
              {isSubmitting ? "Logging in..." : "Login"}
            </button>
          </form>

          {message ? (
            <p className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-center text-sm font-medium text-gray-900">
              {message}
              {unverifiedEmail ? (
                <>
                  {" "}
                  <Link
                    href={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                    className="font-bold underline decoration-yellow-500 decoration-2 underline-offset-4"
                  >
                    Resend verification email
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          <p className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            Fast - Secure - No spam
          </p>
          <p className="mt-5 text-center text-xs leading-5 text-gray-500">
            Your account is protected with industry-standard security.
          </p>

          <p className="mt-7 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-bold text-gray-900 underline decoration-yellow-500 decoration-2 underline-offset-4"
            >
              Sign Up
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
