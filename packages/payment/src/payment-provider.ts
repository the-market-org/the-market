/**
 * The Payment Module's provider contract.
 * The order and cart modules only ever see these types: nothing here is
 * specific to Stripe, PayPal or any other gateway.
 */
export type PaymentStatus =
  | "pending"
  | "requires_action"
  | "authorized"
  | "captured"
  | "refunded"
  | "canceled"
  | "failed";

/** Amounts are integers in the currency's minor unit (pence, cents). */
export interface CreatePaymentInput {
  orderId: string;
  amountMinor: number;
  currencyCode: string;
  idempotencyKey: string;
}

export interface PaymentSession {
  providerReference: string;
  status: PaymentStatus;
  /** Set when the storefront must confirm the payment in the browser. */
  clientSecret?: string;
  /** Set when the buyer must be redirected to the gateway. */
  redirectUrl?: string;
}

export interface PaymentChange {
  providerReference: string;
  amountMinor: number;
  idempotencyKey: string;
}

export interface PaymentEvent {
  eventType: string;
  providerReference: string;
  status: PaymentStatus;
}

export interface PaymentProvider {
  providerId: string;
  createPayment: (input: CreatePaymentInput) => Promise<PaymentSession>;
  capturePayment: (input: PaymentChange) => Promise<PaymentSession>;
  refundPayment: (input: PaymentChange) => Promise<PaymentSession>;
  cancelPayment: (input: { providerReference: string; idempotencyKey: string }) => Promise<PaymentSession>;
  /** Verifies a gateway webhook and translates it. Throws if the signature is wrong. */
  parseWebhook: (input: { bodyText: string; signatureHeader: string }) => Promise<PaymentEvent>;
}

export type ProviderRegistry = Record<string, PaymentProvider>;

/** Returns a new registry with the provider added under its providerId. */
export function addProvider(input: { registry: ProviderRegistry; provider: PaymentProvider }): ProviderRegistry {
  return { ...input.registry, [input.provider.providerId]: input.provider };
}

export function resolveProvider(input: { registry: ProviderRegistry; providerId: string }): PaymentProvider {
  const provider = input.registry[input.providerId];
  if (provider === undefined) {
    throw new Error(`Payment provider "${input.providerId}" is not registered`);
  }
  return provider;
}
