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
  providerReference: string;
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

/**
 * Provider-specific implementations must create hosted checkout sessions
 * and verify signed webhooks before a booking can be marked as paid.
 * Raw card details must remain on the provider's PCI-compliant checkout.
 */
export function getCardPaymentProvider(): CardPaymentProvider | null {
  // Intentionally empty until ZuriStay selects and completes onboarding
  // with a licensed acquiring/payment provider. Never simulate success here.
  return null;
}
