import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type AuthenticatedApiUser = {
  user: User;
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
};

export type AuthenticatedApiUserClient = {
  supabase: SupabaseClient;
  user: User;
};

const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.trim().split(/\s+/, 2);

  return scheme?.toLowerCase() === "bearer" ? token ?? "" : "";
}

export async function getAuthenticatedApiUser(
  request: Request,
): Promise<AuthenticatedApiUser | null> {
  const supabase = createSupabaseAdminClient();
  const token = getBearerToken(request);

  if (!supabase || !token) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return { supabase, user: data.user };
}

export async function getAuthenticatedApiUserClient(
  request: Request,
): Promise<AuthenticatedApiUserClient | null> {
  const token = getBearerToken(request);

  if (!publicSupabaseUrl || !publicSupabaseAnonKey || !token) {
    return null;
  }

  const supabase = createClient(publicSupabaseUrl, publicSupabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return { supabase, user: data.user };
}

export function logPaymentServerError(message: string, error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const supabaseError = error as {
      code?: string;
      details?: string;
      hint?: string;
      message?: string;
      status?: number;
    };

    if (process.env.NODE_ENV === "development") {
      console.error(message, {
        code: supabaseError.code,
        details: supabaseError.details,
        hint: supabaseError.hint,
        message: supabaseError.message,
        status: supabaseError.status,
      });
    } else {
      console.error(message, {
        code: supabaseError.code,
        status: supabaseError.status,
      });
    }
    return;
  }

  console.error(
    message,
    error instanceof Error
      ? { name: error.name }
      : { type: typeof error },
  );
}
