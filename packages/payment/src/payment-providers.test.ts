import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import type { HttpRequest } from "@the-market/core";
import { addProvider, buildPaypalProvider, composeStripeProvider, resolveProvider } from "./index.ts";

function computeTestHmac(input: { secret: string; payload: string }): string {
  return createHmac("sha256", input.secret).update(input.payload).digest("hex");
}

function buildStripeUnderTest(sentRequests: HttpRequest[]) {
  return composeStripeProvider({
    secretKey: "sk_test_placeholder",
    webhookSecret: "whsec_placeholder",
    computeHmac: computeTestHmac,
    matchDigests: (expected, received) => expected === received,
    sendRequest: async (request) => {
      sentRequests.push(request);
      const bodyText = JSON.stringify({ id: "pi_1", status: "requires_capture", client_secret: "pi_1_secret" });
      return { status: 200, headers: {}, bodyText };
    },
  });
}

test("Stripe provider creates a manual-capture PaymentIntent through the contract", async () => {
  const sentRequests: HttpRequest[] = [];
  const registry = addProvider({ registry: {}, provider: buildStripeUnderTest(sentRequests) });
  const provider = resolveProvider({ registry, providerId: "stripe" });

  const session = await provider.createPayment({
    orderId: "order_1",
    amountMinor: 2599,
    currencyCode: "GBP",
    idempotencyKey: "order_1-create",
  });

  assert.deepEqual(session, { providerReference: "pi_1", status: "authorized", clientSecret: "pi_1_secret" });
  const request = sentRequests[0] as HttpRequest;
  assert.equal(request.url, "https://api.stripe.com/v1/payment_intents");
  assert.equal(request.headers["idempotency-key"], "order_1-create");
  assert.match(request.bodyText, /amount=2599&currency=gbp&capture_method=manual/);
});

test("Stripe provider accepts a correctly signed webhook and rejects a forged one", async () => {
  const provider = buildStripeUnderTest([]);
  const bodyText = JSON.stringify({
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_1", status: "succeeded" } },
  });
  const digest = computeTestHmac({ secret: "whsec_placeholder", payload: `1700000000.${bodyText}` });

  const paymentEvent = await provider.parseWebhook({ bodyText, signatureHeader: `t=1700000000,v1=${digest}` });
  assert.deepEqual(paymentEvent, {
    eventType: "payment_intent.succeeded",
    providerReference: "pi_1",
    status: "captured",
  });
  await assert.rejects(
    provider.parseWebhook({ bodyText, signatureHeader: "t=1700000000,v1=forged" }),
    /signature mismatch/,
  );
});

test("PayPal placeholder registers but refuses calls, and unknown providers fail loudly", async () => {
  const registry = addProvider({ registry: {}, provider: buildPaypalProvider() });
  const paypal = resolveProvider({ registry, providerId: "paypal" });
  await assert.rejects(
    paypal.createPayment({ orderId: "order_1", amountMinor: 100, currencyCode: "GBP", idempotencyKey: "key" }),
    /not implemented/,
  );
  assert.throws(() => resolveProvider({ registry, providerId: "klarna" }), /not registered/);
});
