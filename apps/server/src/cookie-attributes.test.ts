import assert from "node:assert/strict";
import { test } from "node:test";
import { LEAD, buildShopRegistry } from "./checkout/shop-fakes.ts";
import { composeServer } from "./compose.ts";

async function readCookies(allowLocalHttp: boolean | undefined) {
  const app = await composeServer({ readUptime: () => 0, registry: buildShopRegistry(), capabilities: {}, merchantToken: "", identity: { verifyToken: async () => undefined }, identityEnabled: false, allowLocalHttp });
  const page = await app.request("/products/rope-lead", { headers: { host: "shop-a.example" } });
  const added = await app.request("/cart/lines", { method: "POST", headers: { host: "shop-a.example", "content-type": "application/x-www-form-urlencoded" }, body: `productId=${LEAD}&quantity=1` });
  return [String(page.headers.get("set-cookie")), String(added.headers.get("set-cookie"))];
}

test("outside development every storefront cookie is Secure", async () => {
  for (const cookie of await readCookies(undefined)) {
    assert.match(cookie, /; Path=\/; HttpOnly; SameSite=Lax; Secure; Max-Age=\d+$/);
  }
});

test("in development over plain http no cookie is Secure, so localhost keeps working", async () => {
  for (const cookie of await readCookies(true)) {
    assert.doesNotMatch(cookie, /Secure/);
    assert.match(cookie, /; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+$/);
  }
});
