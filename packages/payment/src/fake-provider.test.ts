import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFakeProvider } from "./fake-provider.ts";

const provider = buildFakeProvider({ declineAmountMinor: 666 });

test("a payment is authorised at once, with a reference fixed by its idempotency key", async () => {
  const first = await provider.createPayment({ orderId: "order_1", amountMinor: 2500, currencyCode: "GBP", idempotencyKey: "order_1" });
  const again = await provider.createPayment({ orderId: "order_1", amountMinor: 2500, currencyCode: "GBP", idempotencyKey: "order_1" });
  assert.deepEqual(first, { providerReference: "fake_order_1", status: "authorized" });
  assert.deepEqual(again, first);
  assert.equal(provider.providerId, "fake");
});

test("the chosen amount is declined, so a failed payment can be shown on purpose", async () => {
  await assert.rejects(provider.createPayment({ orderId: "order_2", amountMinor: 666, currencyCode: "GBP", idempotencyKey: "order_2" }), { message: "Payment declined" });
});

test("capture, refund and cancel answer their status; webhooks are refused", async () => {
  const change = { providerReference: "fake_order_1", amountMinor: 2500, idempotencyKey: "change_1" };
  assert.equal((await provider.capturePayment(change)).status, "captured");
  assert.equal((await provider.refundPayment(change)).status, "refunded");
  assert.equal((await provider.cancelPayment({ providerReference: "fake_order_1", idempotencyKey: "cancel_1" })).status, "canceled");
  await assert.rejects(provider.parseWebhook({ bodyText: "{}", signatureHeader: "" }), { message: "The fake provider sends no webhooks" });
});
