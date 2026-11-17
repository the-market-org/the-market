/**
 * A payment provider that moves no money, for development, tests and demos until a real
 * gateway's keys are configured. One chosen amount is always declined.
 */
import type { PaymentProvider } from "./payment-provider.ts";

export function buildFakeProvider(input: { declineAmountMinor: number }): PaymentProvider {
  return {
    providerId: "fake",
    createPayment: async (payment) => {
      if (payment.amountMinor === input.declineAmountMinor) {
        throw new Error("Payment declined");
      }
      return { providerReference: `fake_${payment.idempotencyKey}`, status: "authorized" };
    },
    capturePayment: async (change) => ({ providerReference: change.providerReference, status: "captured" }),
    refundPayment: async (change) => ({ providerReference: change.providerReference, status: "refunded" }),
    cancelPayment: async (change) => ({ providerReference: change.providerReference, status: "canceled" }),
    parseWebhook: async () => Promise.reject(new Error("The fake provider sends no webhooks")),
  };
}
