export const CONNECTION_ERROR_MESSAGE =
  "We could not connect. Please check your internet connection and try again.";
export const TOO_MANY_ATTEMPTS_MESSAGE =
  "Too many attempts. Please wait a moment and try again.";
export const INVALID_EMAIL_MESSAGE = "Please enter a valid email address.";
export const PASSWORDS_DO_NOT_MATCH_MESSAGE = "Passwords do not match.";
export const WEAK_PASSWORD_MESSAGE = "Please use a stronger password.";
export const PRIVACY_SAFE_RESET_SUCCESS_MESSAGE =
  "If an account exists for this email, a reset link has been sent.";
export const PRIVACY_SAFE_SIGNUP_MESSAGE =
  "If this email is eligible for registration, check your inbox for next steps.";

type AuthErrorLike = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
  statusText?: unknown;
};

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getPasswordStrengthError(password: string) {
  if (password.length < 8) {
    return WEAK_PASSWORD_MESSAGE;
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return WEAK_PASSWORD_MESSAGE;
  }

  return "";
}

function readAuthError(error: unknown): AuthErrorLike {
  if (!error || typeof error !== "object") {
    return {};
  }

  return error as AuthErrorLike;
}

function errorText(error: unknown) {
  const authError = readAuthError(error);

  return [
    authError.code,
    authError.message,
    authError.name,
    authError.status,
    authError.statusText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function logAuthError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const authError = readAuthError(error);

  console.error(context, {
    code: authError.code,
    details: authError.details,
    hint: authError.hint,
    message: authError.message,
    name: authError.name,
    status: authError.status,
    statusText: authError.statusText,
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export function isNetworkError(error: unknown) {
  const text = errorText(error);

  return (
    error instanceof TypeError ||
    text.includes("failed to fetch") ||
    text.includes("network") ||
    text.includes("fetcherror") ||
    text.includes("timeout")
  );
}

export function isRateLimitError(error: unknown) {
  const authError = readAuthError(error);
  const text = errorText(error);

  return (
    authError.status === 429 ||
    text.includes("rate") ||
    text.includes("too many") ||
    text.includes("limit")
  );
}

export function isEmailNotVerifiedError(error: unknown) {
  const text = errorText(error);

  return (
    text.includes("email_not_confirmed") ||
    text.includes("email not confirmed") ||
    text.includes("email is not confirmed") ||
    text.includes("confirm your email")
  );
}

export function isInvalidCredentialsError(error: unknown) {
  const text = errorText(error);

  return (
    text.includes("invalid_credentials") ||
    text.includes("invalid login") ||
    text.includes("invalid credentials") ||
    text.includes("invalid email or password")
  );
}

export function isWeakPasswordError(error: unknown) {
  const text = errorText(error);

  return text.includes("weak password") || text.includes("password");
}

export function isAlreadyRegisteredError(error: unknown) {
  const text = errorText(error);

  return (
    text.includes("already registered") ||
    text.includes("already exists") ||
    text.includes("user already") ||
    text.includes("email_exists")
  );
}

export function isUnknownUserForReset(error: unknown) {
  const text = errorText(error);

  return text.includes("user not found") || text.includes("not found");
}

export function isAlreadyVerifiedError(error: unknown) {
  const text = errorText(error);

  return (
    text.includes("already confirmed") ||
    text.includes("already verified") ||
    text.includes("email already")
  );
}

export function getFriendlyLoginError(error: unknown) {
  if (isEmailNotVerifiedError(error)) {
    return "Please verify your email before logging in.";
  }

  if (isRateLimitError(error)) {
    return TOO_MANY_ATTEMPTS_MESSAGE;
  }

  if (isNetworkError(error)) {
    return CONNECTION_ERROR_MESSAGE;
  }

  if (isInvalidCredentialsError(error)) {
    return "Incorrect email or password.";
  }

  return "Incorrect email or password.";
}

export function getFriendlySignupError(error: unknown) {
  if (isAlreadyRegisteredError(error)) {
    return "We could not create your account with those details. Please try signing in or resetting your password.";
  }

  if (isWeakPasswordError(error)) {
    return WEAK_PASSWORD_MESSAGE;
  }

  if (isRateLimitError(error)) {
    return TOO_MANY_ATTEMPTS_MESSAGE;
  }

  if (isNetworkError(error)) {
    return CONNECTION_ERROR_MESSAGE;
  }

  return "We could not create your account. Please try again.";
}

export function getFriendlyResendError(error: unknown) {
  if (isAlreadyVerifiedError(error)) {
    return PRIVACY_SAFE_SIGNUP_MESSAGE;
  }

  if (isRateLimitError(error)) {
    return TOO_MANY_ATTEMPTS_MESSAGE;
  }

  if (isNetworkError(error)) {
    return CONNECTION_ERROR_MESSAGE;
  }

  return "We could not send a verification email. Please try again.";
}
