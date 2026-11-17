import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "../compose.ts";
import { LEAD, buildShopRegistry } from "./shop-fakes.ts";

async function buildClient() {
  const app = await composeServer({ readUptime: () => 0, registry: buildShopRegistry(), capabilities: {}, merchantToken: "", identity: { verifyToken: async () => undefined }, identityEnabled: false });
  return async (input: { method: string; path: string; host?: string; body?: unknown }) => {
    const response = await app.request(input.path, { method: input.method, headers: { host: input.host ?? "shop-a.example", "content-type": "application/json" }, ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }) });
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };
}

test("a shopper creates a cart, adds a product and sees it priced from the catalog", async () => {
  const send = await buildClient();
  const created = await send({ method: "POST", path: "/api/carts" });
  assert.equal(created.status, 201);
  const { cartId } = created.body;

  const empty = await send({ method: "GET", path: `/api/carts/${cartId}` });
  assert.deepEqual([empty.status, empty.body.totalMinor, empty.body.lines], [200, 0, []]);

  const added = await send({ method: "PUT", path: `/api/carts/${cartId}/lines/${LEAD}`, body: { quantity: 2 } });
  assert.deepEqual([added.status, added.body.totalMinor, added.body.currencyCode, added.body.lines[0].title], [200, 3600, "GBP", "Rope lead"]);
});

test("another store's host cannot see the cart, and a bad quantity is refused", async () => {
  const send = await buildClient();
  const { cartId } = (await send({ method: "POST", path: "/api/carts" })).body;
  assert.deepEqual(await send({ method: "GET", path: `/api/carts/${cartId}`, host: "shop-b.example" }), { status: 404, body: { error: "Cart not found" } });
  assert.equal((await send({ method: "PUT", path: `/api/carts/${cartId}/lines/${LEAD}`, body: { quantity: "two" } })).status, 400);
});
