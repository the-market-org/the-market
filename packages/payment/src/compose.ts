/**
 * Composition root: the one place in this package that wires concrete
 * functions together. Everything else receives its collaborators as parameters.
 */
import type { SendRequest } from "@the-market/core";
import type { PaymentProvider } from "./payment-provider.ts";
import {
  buildStripeProvider,
  encodeForm,
  mapStripeStatus,
  postStripeForm,
  verifyStripeEvent,
} from "./stripe-provider.ts";

export function composeStripeProvider(input: {
  secretKey: string;
  webhookSecret: string;
  sendRequest: SendRequest;
  computeHmac: (input: { secret: string; payload: string }) => string;
  matchDigests: (expected: string, received: string) => boolean;
}): PaymentProvider {
  return buildStripeProvider({
    mapStatus: mapStripeStatus,
    postForm: (form) =>
      postStripeForm({ ...form, secretKey: input.secretKey, sendRequest: input.sendRequest, encodeFields: encodeForm }),
    verifyEvent: (webhook) =>
      verifyStripeEvent({
        ...webhook,
        webhookSecret: input.webhookSecret,
        computeHmac: input.computeHmac,
        matchDigests: input.matchDigests,
        mapStatus: mapStripeStatus,
      }),
  });
}
