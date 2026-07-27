export function getAuthCallbackUrl() {
  const explicitCallbackUrl = process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL;

  if (explicitCallbackUrl) {
    return explicitCallbackUrl;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (siteUrl) {
    return `${siteUrl.replace(/\/$/, "")}/auth/callback`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }

  return "http://localhost:3000/auth/callback";
}

export function getVerifyEmailPath(email?: string, error?: string) {
  const params = new URLSearchParams();

  if (email) {
    params.set("email", email);
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();

  return query ? `/verify-email?${query}` : "/verify-email";
}
