import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFakeProvider } from "@the-market/payment";
import { LEAD, buildShopRegistry } from "../checkout/shop-fakes.ts";
import { composeServer } from "../compose.ts";

async function buildBrowser(declineAmountMinor = -1) {
  const registry = buildShopRegistry();
  const app = await composeServer({ readUptime: () => 0, registry, capabilities: {}, merchantToken: "", identity: { verifyToken: async () => undefined }, identityEnabled: false, paymentProvider: buildFakeProvider({ declineAmountMinor }) });
  let cookie = "";
  return async (input: { method?: string; path: string; form?: Record<string, string> }) => {
    const headers = { host: "shop-a.example", cookie, "content-type": "application/x-www-form-urlencoded" };
    const response = await app.request(input.path, { method: input.method ?? "GET", headers, body: input.form && new URLSearchParams(input.form).toString() });
    const setCookie = response.headers.get("set-cookie") ?? "";
    cookie = setCookie === "" ? cookie : setCookie.split(";")[0] ?? "";
    return { status: response.status, location: response.headers.get("location"), setCookie, html: await response.text() };
  };
}

test("a shopper adds to cart, sees it, pays and is thanked", async () => {
  const browse = await buildBrowser();
  const added = await browse({ method: "POST", path: "/cart/lines", form: { productId: LEAD, quantity: "2" } });
  assert.deepEqual([added.status, added.location], [303, "/cart"]);
  assert.match(added.setCookie, /^cart_id=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/);

  await browse({ method: "POST", path: "/cart/lines", form: { productId: LEAD, quantity: "1" } });
  const cart = await browse({ path: "/cart" });
  assert.match(cart.html, /<li>3 × Rope lead <span>£54.00<\/span><\/li>/);

  const paid = await browse({ method: "POST", path: "/cart/checkout" });
  assert.equal(paid.status, 303);
  assert.match(String(paid.location), /^\/orders\/order_1$/);
  assert.match(paid.setCookie, /^cart_id=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0$/);

  const thanks = await browse({ path: String(paid.location) });
  assert.match(thanks.html, /<h1>Thank you<\/h1><p>Order 1 is paid: £54.00\.<\/p>/);
  assert.match((await browse({ path: "/cart" })).html, /Your cart is empty/);
});

test("a declined payment shows the cart again with the reason", async () => {
  const browse = await buildBrowser(3600);
  await browse({ method: "POST", path: "/cart/lines", form: { productId: LEAD, quantity: "2" } });
  const declined = await browse({ method: "POST", path: "/cart/checkout" });
  assert.equal(declined.status, 422);
  assert.match(declined.html, /<p class="error">take payment failed: Payment declined<\/p>/);
  assert.match(declined.html, /<li>2 × Rope lead/);
});

test("an unknown order and a bad quantity are refused", async () => {
  const browse = await buildBrowser();
  assert.equal((await browse({ path: "/orders/not-an-order" })).status, 404);
  assert.equal((await browse({ method: "POST", path: "/cart/lines", form: { productId: LEAD, quantity: "500" } })).status, 400);
});
