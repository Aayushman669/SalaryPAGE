"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { type Session, type User } from "@supabase/supabase-js";
import {
  ensureProfile,
  getProfile,
  getProfileRedirectPath,
} from "@/lib/auth-profiles";
import {
  CONNECTION_ERROR_MESSAGE,
  getFriendlyLoginError,
  getFriendlySignupError,
  INVALID_EMAIL_MESSAGE,
  isEmailNotVerifiedError,
  isValidEmail,
  logAuthError,
  PRIVACY_SAFE_SIGNUP_MESSAGE,
} from "@/lib/auth-errors";
import { getAuthCallbackUrl, getVerifyEmailPath } from "@/lib/auth-redirects";
import {
  getSafeProtectedNextPath,
  isAdminAuthMetadata,
} from "@/lib/auth-routes";
import { enqueueClientEmailEvent } from "@/lib/email/client";
import { supabase } from "@/lib/supabase";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type AuthActionResult = {
  error: string | null;
  message?: string;
  redirectTo?: string;
  resendEmail?: string;
};

type AuthContextValue = {
  isAuthLoading: boolean;
  isLoggedIn: boolean;
  getCurrentUser: () => Promise<User | null>;
  getCurrentRedirectPath: () => Promise<string>;
  login: (
    email: string,
    password: string,
    intendedPath?: string | null,
  ) => Promise<AuthActionResult>;
  signup: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<AuthActionResult>;
  logout: () => Promise<AuthActionResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const INITIAL_SESSION_TIMEOUT_MS = 10_000;

async function getPostAuthPath(
  userId: string,
  fallbackEmail = "",
  fallbackFullName = "",
) {
  if (!supabase) {
    return {
      error: "Supabase is not configured. Please check your environment variables.",
      redirectTo: "/login",
    };
  }

  const { error, profile } = await getProfile(userId);

  if (error) {
    return {
      error,
      redirectTo: "/onboarding",
    };
  }

  if (profile) {
    return {
      error: null,
      redirectTo: getProfileRedirectPath(profile),
    };
  }

  const profileError = await ensureProfile({
    email: fallbackEmail,
    fullName: fallbackFullName,
    userId,
  });

  if (profileError) {
    return {
      error: profileError,
      redirectTo: "/onboarding",
    };
  }

  return {
    error: null,
    redirectTo: "/onboarding",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) {
      window.setTimeout(() => setIsAuthLoading(false), 0);
      return;
    }

    const sessionLookup = supabase.auth.getSession();
    const sessionTimeout = new Promise<Awaited<typeof sessionLookup>>((resolve) => {
      window.setTimeout(() => resolve({ data: { session: null }, error: null }), INITIAL_SESSION_TIMEOUT_MS);
    });

    Promise.race([sessionLookup, sessionTimeout])
      .then(({ data, error }) => {
        if (error) {
          logAuthError("[auth] initial session lookup failed", error);
        }

        setSession(data.session);
        setIsAuthLoading(false);
      })
      .catch((error: unknown) => {
        logAuthError("[auth] initial session network failure", error);
        setSession(null);
        setIsAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getCurrentUser = useCallback(async () => {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.auth.getUser();

    if (error) {
      logAuthError("[auth] current user lookup failed", error);
      return null;
    }

    return data.user;
  }, []);

  const getCurrentRedirectPath = useCallback(async () => {
    const user = await getCurrentUser();

    if (!user) {
      return "/login";
    }

    if (isAdminAuthMetadata(user.app_metadata)) {
      return "/admin";
    }

    const result = await getPostAuthPath(
      user.id,
      user.email ?? "",
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : "",
    );

    return result.redirectTo;
  }, [getCurrentUser]);

  const login = useCallback(async (
    email: string,
    password: string,
    intendedPath?: string | null,
  ) => {
    const trimmedEmail = email.trim();

    if (!supabase) {
      return {
        error:
          "Supabase is not configured. Please check your environment variables.",
      };
    }

    if (!isValidEmail(trimmedEmail)) {
      return { error: INVALID_EMAIL_MESSAGE };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        logAuthError("[auth] login failed", error);

        return {
          error: getFriendlyLoginError(error),
          resendEmail: isEmailNotVerifiedError(error) ? trimmedEmail : undefined,
        };
      }

      const result = data.user && isAdminAuthMetadata(data.user.app_metadata)
        ? { error: null, redirectTo: "/admin" }
        : data.user
          ? await getPostAuthPath(
            data.user.id,
            data.user.email ?? trimmedEmail,
            typeof data.user.user_metadata?.full_name === "string"
              ? data.user.user_metadata.full_name
              : "",
            )
          : { error: null, redirectTo: "/onboarding" };

      if (result.error) {
        return { error: result.error };
      }

      const safeNextPath =
        result.redirectTo === "/dashboard"
          ? getSafeProtectedNextPath(intendedPath)
          : null;
      const finalRedirectPath = safeNextPath ?? result.redirectTo;

      router.replace(finalRedirectPath);
      return { error: null, redirectTo: finalRedirectPath };
    } catch (error) {
      logAuthError("[auth] login network failure", error);
      return { error: CONNECTION_ERROR_MESSAGE };
    }
  }, [router]);

  const signup = useCallback(
    async (fullName: string, email: string, password: string) => {
      const trimmedEmail = email.trim();
      const trimmedFullName = fullName.trim();

      if (!supabase) {
        return {
          error:
            "Supabase is not configured. Please check your environment variables.",
        };
      }

      if (!isValidEmail(trimmedEmail)) {
        return { error: INVALID_EMAIL_MESSAGE };
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: getAuthCallbackUrl(),
            data: {
              full_name: trimmedFullName,
            },
          },
        });

        if (error) {
          logAuthError("[auth] signup failed", error);
          return { error: getFriendlySignupError(error) };
        }

        if (!data.user) {
          return {
            error:
              "Your account was created, but we could not set up your profile. Please try logging in.",
          };
        }

        if (
          Array.isArray(data.user.identities) &&
          data.user.identities.length === 0
        ) {
          return {
            error: null,
            message: PRIVACY_SAFE_SIGNUP_MESSAGE,
            redirectTo: getVerifyEmailPath(trimmedEmail),
          };
        }

        if (!data.session) {
          return {
            error: null,
            message: "Check your email to confirm your account before logging in.",
            redirectTo: getVerifyEmailPath(data.user.email ?? trimmedEmail),
          };
        }

        const profileError = await ensureProfile({
          email: data.user.email ?? trimmedEmail,
          fullName: trimmedFullName,
          userId: data.user.id,
        });

        if (profileError) {
          return { error: profileError };
        }

        void enqueueClientEmailEvent({ type: "account_created" });

        return {
          error: null,
          message: "Signup successful. Redirecting to onboarding...",
          redirectTo: "/onboarding",
        };
      } catch (error) {
        logAuthError("[auth] signup network failure", error);
        return {
          error: CONNECTION_ERROR_MESSAGE,
        };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut({ scope: "global" });

        if (error) {
          logAuthError("[auth] logout failed", error);
          showErrorToast("We could not connect. Please try again.");
          return { error: CONNECTION_ERROR_MESSAGE };
        }
      }

      setSession(null);
      showSuccessToast("You have been logged out.");
      router.replace("/");

      return { error: null };
    } catch (error) {
      logAuthError("[auth] logout network failure", error);
      showErrorToast("We could not connect. Please try again.");
      return { error: CONNECTION_ERROR_MESSAGE };
    }
  }, [router]);

  const value = useMemo(
    () => ({
      isAuthLoading,
      isLoggedIn: Boolean(session),
      getCurrentUser,
      getCurrentRedirectPath,
      login,
      signup,
      logout,
    }),
    [
      isAuthLoading,
      session,
      getCurrentUser,
      getCurrentRedirectPath,
      login,
      signup,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
