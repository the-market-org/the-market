import type { SendRequest } from "@the-market/core";
import type { PaymentEvent, PaymentProvider, PaymentStatus } from "./payment-provider.ts";

const STRIPE_API = "https://api.stripe.com/v1";

const STRIPE_STATUS_MAP: Record<string, PaymentStatus> = {
  requires_payment_method: "pending",
  requires_confirmation: "pending",
  processing: "pending",
  requires_action: "requires_action",
  requires_capture: "authorized",
  succeeded: "captured",
  canceled: "canceled",
};

type StripeObject = Record<string, unknown>;
type PostForm = (input: {
  path: string;
  fields: Record<string, string>;
  idempotencyKey: string;
}) => Promise<StripeObject>;

export function mapStripeStatus(stripeStatus: string): PaymentStatus {
  return STRIPE_STATUS_MAP[stripeStatus] ?? "failed";
}

export function encodeForm(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([fieldName, fieldValue]) => `${encodeURIComponent(fieldName)}=${encodeURIComponent(fieldValue)}`)
    .join("&");
}

/** Sends one form-encoded POST to the Stripe REST API. */
export async function postStripeForm(input: {
  path: string;
  fields: Record<string, string>;
  idempotencyKey: string;
  secretKey: string;
  sendRequest: SendRequest;
  encodeFields: (fields: Record<string, string>) => string;
}): Promise<StripeObject> {
  const reply = await input.sendRequest({
    url: `${STRIPE_API}${input.path}`,
    method: "POST",
    headers: {
      authorization: `Bearer ${input.secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
      "idempotency-key": input.idempotencyKey,
    },
    bodyText: input.encodeFields(input.fields),
  });
  if (reply.status >= 400) {
    throw new Error(`Stripe ${input.path} failed with status ${reply.status}`);
  }
  return JSON.parse(reply.bodyText) as StripeObject;
}

/**
 * Checks the Stripe-Signature header, then translates the event.
 * Replay protection (timestamp tolerance) is added with the Stripe test-mode PR.
 */
export async function verifyStripeEvent(input: {
  bodyText: string;
  signatureHeader: string;
  webhookSecret: string;
  computeHmac: (input: { secret: string; payload: string }) => string;
  matchDigests: (expected: string, received: string) => boolean;
  mapStatus: (stripeStatus: string) => PaymentStatus;
}): Promise<PaymentEvent> {
  const headerParts = Object.fromEntries(input.signatureHeader.split(",").map((pair) => pair.split("=")));
  const expectedDigest = input.computeHmac({
    secret: input.webhookSecret,
    payload: `${headerParts.t}.${input.bodyText}`,
  });
  if (!input.matchDigests(expectedDigest, String(headerParts.v1))) {
    throw new Error("Stripe webhook signature mismatch");
  }
  const stripeEvent = JSON.parse(input.bodyText) as { type: string; data: { object: StripeObject } };
  return {
    eventType: stripeEvent.type,
    providerReference: String(stripeEvent.data.object.id),
    status: input.mapStatus(String(stripeEvent.data.object.status)),
  };
}

/** Builds the Stripe implementation of the provider contract (PaymentIntents API). */
export function buildStripeProvider(input: {
  postForm: PostForm;
  mapStatus: (stripeStatus: string) => PaymentStatus;
  verifyEvent: PaymentProvider["parseWebhook"];
}): PaymentProvider {
  return {
    providerId: "stripe",
    createPayment: async (payment) => {
      const intent = await input.postForm({
        path: "/payment_intents",
        idempotencyKey: payment.idempotencyKey,
        fields: {
          amount: String(payment.amountMinor),
          currency: payment.currencyCode.toLowerCase(),
          capture_method: "manual",
          "automatic_payment_methods[enabled]": "true",
          "metadata[order_id]": payment.orderId,
        },
      });
      return {
        providerReference: String(intent.id),
        status: input.mapStatus(String(intent.status)),
        clientSecret: String(intent.client_secret),
      };
    },
    capturePayment: async (change) => {
      const intent = await input.postForm({
        path: `/payment_intents/${change.providerReference}/capture`,
        idempotencyKey: change.idempotencyKey,
        fields: { amount_to_capture: String(change.amountMinor) },
      });
      return { providerReference: String(intent.id), status: input.mapStatus(String(intent.status)) };
    },
    refundPayment: async (change) => {
      await input.postForm({
        path: "/refunds",
        idempotencyKey: change.idempotencyKey,
        fields: { payment_intent: change.providerReference, amount: String(change.amountMinor) },
      });
      return { providerReference: change.providerReference, status: "refunded" };
    },
    cancelPayment: async (change) => {
      const intent = await input.postForm({
        path: `/payment_intents/${change.providerReference}/cancel`,
        idempotencyKey: change.idempotencyKey,
        fields: {},
      });
      return { providerReference: String(intent.id), status: input.mapStatus(String(intent.status)) };
    },
    parseWebhook: input.verifyEvent,
  };
}
