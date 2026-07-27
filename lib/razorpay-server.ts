import "server-only";

import crypto from "node:crypto";

type RazorpayApiError = Error & {
  status?: number;
};

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status?: string;
};

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
};

function getRequiredSecret(value: string | undefined) {
  if (!value || value.startsWith("replace_with_")) {
    return "";
  }

  return value;
}

export function getRazorpayConfig(): RazorpayConfig | null {
  const keyId = getRequiredSecret(process.env.RAZORPAY_KEY_ID);
  const keySecret = getRequiredSecret(process.env.RAZORPAY_KEY_SECRET);
  const webhookSecret = getRequiredSecret(process.env.RAZORPAY_WEBHOOK_SECRET);

  if (!keyId || !keySecret) {
    return null;
  }

  return { keyId, keySecret, webhookSecret };
}

function getAuthorizationHeader(config: RazorpayConfig) {
  return `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;
}

async function razorpayRequest<T>(
  config: RazorpayConfig,
  path: string,
  init?: RequestInit,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: getAuthorizationHeader(config),
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: { description?: string } }
      | T
      | null;

    if (!response.ok) {
      const error = new Error(
        "Razorpay could not complete the payment request.",
      ) as RazorpayApiError;
      error.status = response.status;
      throw error;
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createRazorpayOrder({
  amount,
  currency,
  notes,
  receipt,
  config,
}: {
  amount: number;
  currency: string;
  notes: Record<string, string>;
  receipt: string;
  config: RazorpayConfig;
}) {
  return razorpayRequest<RazorpayOrder>(config, "/orders", {
    method: "POST",
    body: JSON.stringify({ amount, currency, notes, receipt }),
  });
}

export async function fetchRazorpayPayment(
  config: RazorpayConfig,
  paymentId: string,
) {
  return razorpayRequest<RazorpayPayment>(
    config,
    `/payments/${encodeURIComponent(paymentId)}`,
  );
}

export async function fetchRazorpayOrder(
  config: RazorpayConfig,
  orderId: string,
) {
  return razorpayRequest<RazorpayOrder>(
    config,
    `/orders/${encodeURIComponent(orderId)}`,
  );
}

function createDigest(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(expected: string, actual: string) {
  if (!/^[a-f0-9]{64}$/i.test(actual) || expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(actual, "hex"),
  );
}

export function verifyCheckoutSignature({
  orderId,
  paymentId,
  signature,
  secret,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}) {
  return safeEqualHex(
    createDigest(`${orderId}|${paymentId}`, secret),
    signature,
  );
}

export function verifyWebhookSignature({
  body,
  signature,
  secret,
}: {
  body: string;
  signature: string;
  secret: string;
}) {
  return safeEqualHex(createDigest(body, secret), signature);
}

export function hashWebhookBody(body: string) {
  return crypto.createHash("sha256").update(body).digest("hex");
}
