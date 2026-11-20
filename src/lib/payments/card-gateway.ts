import { timingSafeEqual } from "node:crypto";

export type CardCheckoutRequest = {
  amount: number;
  currency: string;
  bookingReference: string;
  customerName: string;
  customerEmail: string;
  idempotencyKey: string;
  returnUrl: string;
};

export type CardCheckoutSession = {
  providerSessionId: string;
  checkoutUrl: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type VerifiedCardWebhook = {
  providerSessionId: string;
  providerReference?: string;
  status: "succeeded" | "failed" | "pending";
  amount: number;
  currency: string;
};

export interface CardPaymentProvider {
  readonly name: string;
  createCheckoutSession(input: CardCheckoutRequest): Promise<CardCheckoutSession>;
  verifyWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<VerifiedCardWebhook>;
}

type FlutterwaveEnvelope<T> = {
  status?: string;
  message?: string;
  data?: T;
};

type FlutterwaveCheckoutData = {
  link?: string;
};

type FlutterwaveVerifiedTransaction = {
  id?: number;
  tx_ref?: string;
  flw_ref?: string;
  amount?: number;
  currency?: string;
  status?: string;
};

type FlutterwaveWebhookPayload = {
  event?: string;
  data?: {
    id?: number;
    tx_ref?: string;
    status?: string;
  };
};

function requiredEnvironment() {
  const secretKey = process.env.FLW_SECRET_KEY?.trim();
  const secretHash = process.env.FLW_SECRET_HASH?.trim();
  const mode = (process.env.FLW_ENVIRONMENT || "sandbox").trim().toLowerCase();

  if (!secretKey || !secretHash || !["sandbox", "live"].includes(mode)) return null;

  // Default to sandbox. Live credentials must never be used accidentally.
  if (mode === "sandbox" && !secretKey.startsWith("FLWSECK_TEST-")) return null;
  if (mode === "live" && (!secretKey.startsWith("FLWSECK-") || secretKey.startsWith("FLWSECK_TEST-"))) {
    return null;
  }

  return { secretKey, secretHash, mode };
}

async function flutterwaveRequest<T>(path: string, init: RequestInit = {}) {
  const config = requiredEnvironment();
  if (!config) throw new Error("Flutterwave credentials or environment are not configured.");

  const response = await fetch(`https://api.flutterwave.com/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as FlutterwaveEnvelope<T> | null;
  if (!response.ok || payload?.status !== "success" || !payload.data) {
    throw new Error(`Flutterwave API request failed (${response.status}).`);
  }
  return payload.data;
}

function verifyFlutterwaveSignature(signature: string | undefined) {
  const config = requiredEnvironment();
  if (!config || !signature) return false;

  // Flutterwave v3 Standard webhooks send the configured secret hash
  // unchanged in the "verif-hash" header (not an HMAC digest).
  const expected = Buffer.from(config.secretHash, "utf8");
  const received = Buffer.from(signature, "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

class FlutterwaveCardProvider implements CardPaymentProvider {
  readonly name = "flutterwave";

  async createCheckoutSession(input: CardCheckoutRequest): Promise<CardCheckoutSession> {
    if (!Number.isFinite(input.amount) || input.amount <= 0 || !Number.isInteger(input.amount)) {
      throw new Error("Flutterwave checkout requires a positive whole-number amount.");
    }
    if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error("Invalid checkout currency.");
    if (!input.customerEmail || !input.idempotencyKey) throw new Error("Missing checkout customer or reference.");

    const data = await flutterwaveRequest<FlutterwaveCheckoutData>("/payments", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: input.idempotencyKey,
        amount: input.amount,
        currency: input.currency,
        redirect_url: input.returnUrl,
        customer: {
          email: input.customerEmail,
          name: input.customerName || "ZuriStay Guest",
        },
        customizations: {
          title: "ZuriStay booking",
          description: `Booking ${input.bookingReference}`,
        },
        configuration: {
          session_duration: 30,
          max_retry_attempt: 3,
        },
        payment_options: "card",
        meta: {
          booking_reference: input.bookingReference,
          payment_attempt_id: input.idempotencyKey,
        },
      }),
    });

    if (!data.link) throw new Error("Flutterwave did not return a hosted checkout link.");
    const checkoutUrl = new URL(data.link);
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.flutterwave.com") {
      throw new Error("Flutterwave returned an untrusted checkout URL.");
    }

    return {
      // tx_ref is the stable correlation ID; flw_ref is stored separately
      // after the server verifies the completed transaction.
      providerSessionId: input.idempotencyKey,
      checkoutUrl: checkoutUrl.toString(),
      metadata: { mode: requiredEnvironment()?.mode ?? "sandbox" },
    };
  }

  async verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<VerifiedCardWebhook> {
    if (!verifyFlutterwaveSignature(headers["verif-hash"])) {
      throw new Error("Invalid Flutterwave webhook signature.");
    }

    const payload = JSON.parse(rawBody) as FlutterwaveWebhookPayload;
    const transactionReference = payload.data?.tx_ref;
    if (typeof transactionReference !== "string" || !transactionReference.trim()) {
      throw new Error("Flutterwave webhook is missing its merchant transaction reference.");
    }

    // Verify the merchant-generated tx_ref against Flutterwave's API. Never
    // use the webhook's status or amount as the authoritative payment result.
    const query = new URLSearchParams({ tx_ref: transactionReference });
    const verified = await flutterwaveRequest<FlutterwaveVerifiedTransaction>(
      `/transactions/verify_by_reference?${query.toString()}`,
      { method: "GET" }
    );

    if (
      verified.tx_ref !== transactionReference ||
      !verified.flw_ref ||
      !Number.isFinite(Number(verified.amount)) ||
      !verified.currency
    ) {
      throw new Error("Flutterwave transaction verification returned incomplete or mismatched details.");
    }

    const normalizedStatus = String(verified.status || "").toLowerCase();
    const status: VerifiedCardWebhook["status"] =
      normalizedStatus === "successful" || normalizedStatus === "succeeded"
        ? "succeeded"
        : normalizedStatus === "failed" || normalizedStatus === "cancelled"
          ? "failed"
          : "pending";

    return {
      providerSessionId: verified.tx_ref,
      providerReference: String(verified.flw_ref),
      status,
      amount: Number(verified.amount),
      currency: String(verified.currency).toUpperCase(),
    };
  }
}

/**
 * Only enables checkout when both server-only credentials are present and
 * their key prefix matches the explicitly selected environment.
 * Raw card details remain on Flutterwave's hosted PCI-compliant checkout.
 */
export function getCardPaymentProvider(): CardPaymentProvider | null {
  if (!requiredEnvironment()) return null;
  return new FlutterwaveCardProvider();
}
