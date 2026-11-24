import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFakeProvider } from "@the-market/payment";
import { composeServer } from "../compose.ts";
import { LEAD, buildShopRegistry } from "./shop-fakes.ts";

async function buildShop(declineAmountMinor = -1) {
  const orders: Array<{ orderId: string; orderNumber: number; status: string; totalMinor: number; paymentReference: string }> = [];
  const registry = buildShopRegistry(orders);
  const app = await composeServer({ readUptime: () => 0, registry, capabilities: {}, merchantToken: "", identity: { verifyToken: async () => undefined }, identityEnabled: false, paymentProvider: buildFakeProvider({ declineAmountMinor }) });
  const send = async (input: { method: string; path: string; host?: string; body?: unknown }) => {
    const response = await app.request(input.path, { method: input.method, headers: { host: input.host ?? "shop-a.example", "content-type": "application/json" }, ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }) });
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };
  const { cartId } = (await send({ method: "POST", path: "/api/carts" })).body;
  await send({ method: "PUT", path: `/api/carts/${cartId}/lines/${LEAD}`, body: { quantity: 2 } });
  return { send, cartId, orders, registry };
}

test("checking out a cart places a paid order and closes the cart", async () => {
  const { send, cartId, orders } = await buildShop();
  const checkout = await send({ method: "POST", path: `/api/carts/${cartId}/checkout` });
  assert.deepEqual([checkout.status, checkout.body.orderNumber, checkout.body.status, checkout.body.totalMinor, checkout.body.currencyCode], [201, 1, "paid", 3600, "GBP"]);
  assert.deepEqual([orders[0]?.status, orders[0]?.paymentReference], ["paid", "fake_order_1"]);
  assert.equal((await send({ method: "GET", path: `/api/carts/${cartId}` })).body.status, "converted");
  assert.deepEqual(await send({ method: "POST", path: `/api/carts/${cartId}/checkout` }), { status: 409, body: { error: "Cart is already checked out" } });
});

test("a declined payment cancels the order and leaves the cart open", async () => {
  const { send, cartId, orders } = await buildShop(3600);
  const checkout = await send({ method: "POST", path: `/api/carts/${cartId}/checkout` });
  assert.deepEqual(checkout, { status: 422, body: { error: "take payment failed: Payment declined" } });
  assert.equal(orders[0]?.status, "canceled");
  assert.equal((await send({ method: "GET", path: `/api/carts/${cartId}` })).body.status, "open");
});

test("another store's cart cannot be checked out", async () => {
  const { send, cartId } = await buildShop();
  assert.deepEqual(await send({ method: "POST", path: `/api/carts/${cartId}/checkout`, host: "shop-b.example" }), { status: 404, body: { error: "Cart not found" } });
});
