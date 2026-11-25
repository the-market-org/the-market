import assert from "node:assert/strict";
import { test } from "node:test";
import { buildShopRegistry } from "./checkout/shop-fakes.ts";
import { composeServer } from "./compose.ts";
import { addSecurityHeaders, CONTENT_SECURITY_POLICY } from "./security-headers.ts";

async function buildShop() {
  const app = await composeServer({ readUptime: () => 0, registry: buildShopRegistry(), capabilities: {}, merchantToken: "", identity: { verifyToken: async () => undefined }, identityEnabled: false });
  return (path: string, host = "shop-a.example") => app.request(path, { headers: { host } });
}

test("every storefront page carries the content security policy, and none needs inline script", async () => {
  const open = await buildShop();
  for (const path of ["/", "/products/rope-lead", "/cart", "/products/no-such-thing"]) {
    const response = await open(path);
    assert.equal(response.headers.get("content-security-policy"), CONTENT_SECURITY_POLICY, path);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", path);
    assert.equal(response.headers.get("referrer-policy"), "same-origin", path);
    const html = await response.text();
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)|\son[a-z]+\s*=/i, `${path} has inline script`);
  }
});

test("JSON replies carry nosniff but no page policy, including the unknown-store reply", async () => {
  const open = await buildShop();
  const unknown = await open("/", "nobody.example");
  assert.deepEqual([unknown.status, unknown.headers.get("x-content-type-options"), unknown.headers.get("content-security-policy")], [404, "nosniff", null]);
  assert.deepEqual(addSecurityHeaders({ "content-type": "application/json" }), { "x-content-type-options": "nosniff", "content-type": "application/json" });
});

test("a reply's own header wins over the default", () => {
  const headers = addSecurityHeaders({ "content-type": "text/html; charset=utf-8", "referrer-policy": "no-referrer" });
  assert.equal(headers["referrer-policy"], "no-referrer");
  assert.equal(headers["content-security-policy"], CONTENT_SECURITY_POLICY);
});
