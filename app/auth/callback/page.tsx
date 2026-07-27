"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { type EmailOtpType, type User } from "@supabase/supabase-js";
import AuthLoading from "../../auth-loading";
import {
  ensureProfile,
  getProfile,
  getProfileRedirectPath,
} from "@/lib/auth-profiles";
import { logAuthError } from "@/lib/auth-errors";
import { getVerifyEmailPath } from "@/lib/auth-redirects";
import { enqueueClientEmailEvent } from "@/lib/email/client";
import { supabase } from "@/lib/supabase";

function getMetadataFullName(user: User) {
  return typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : "";
}

function getHashParam(name: string) {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  return new URLSearchParams(hash).get(name);
}

function isSupportedEmailOtpType(value: string | null): value is EmailOtpType {
  return value === "signup" || value === "email" || value === "email_change";
}

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function resolveConfirmation() {
      const client = supabase;

      if (!client) {
        router.replace(getVerifyEmailPath(undefined, "invalid"));
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const errorParam =
        searchParams.get("error") ||
        searchParams.get("error_description") ||
        getHashParam("error") ||
        getHashParam("error_description");

      if (errorParam) {
        if (process.env.NODE_ENV === "development") {
          console.error("[auth-callback] confirmation failed", {
            message: errorParam,
          });
        }

        router.replace(getVerifyEmailPath(undefined, "invalid"));
        return;
      }

      const tokenHash = searchParams.get("token_hash");
      const typeParam = searchParams.get("type");
      const type = isSupportedEmailOtpType(typeParam) ? typeParam : null;
      let confirmedUser: User | null = null;

      if (typeParam && !type) {
        router.replace(getVerifyEmailPath(undefined, "invalid"));
        return;
      }

      if (tokenHash && !type) {
        router.replace(getVerifyEmailPath(undefined, "invalid"));
        return;
      }

      if (tokenHash && type) {
        const { data, error } = await client.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });

        if (error) {
          logAuthError("[auth-callback] verifyOtp failed", error);

          router.replace(getVerifyEmailPath(undefined, "invalid"));
          return;
        }

        confirmedUser = data.user;
      }

      if (!confirmedUser) {
        const { data, error } = await client.auth.getUser();

        if (error) {
          logAuthError("[auth-callback] getUser failed", error);
        }

        confirmedUser = data.user;
      }

      if (!confirmedUser) {
        router.replace(getVerifyEmailPath(undefined, "invalid"));
        return;
      }

      const profileError = await ensureProfile({
        email: confirmedUser.email ?? "",
        fullName: getMetadataFullName(confirmedUser),
        userId: confirmedUser.id,
      });

      if (profileError && process.env.NODE_ENV === "development") {
        console.warn("[auth-callback] profile ensure warning", {
          message: profileError,
        });
      }

      const { error: fetchError, profile } = await getProfile(confirmedUser.id);

      if (fetchError) {
        router.replace(
          getVerifyEmailPath(confirmedUser.email ?? undefined, "profile"),
        );
        return;
      }

      if (!isMounted) {
        return;
      }

      void enqueueClientEmailEvent({ type: "account_created" });

      router.replace(getProfileRedirectPath(profile));
    }

    resolveConfirmation().catch((error: unknown) => {
      logAuthError("[auth-callback] unexpected failure", error);

      router.replace(getVerifyEmailPath(undefined, "invalid"));
    });

    return () => {
      isMounted = false;
    };
  }, [router]);

  return <AuthLoading />;
}
