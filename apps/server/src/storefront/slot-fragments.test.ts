import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "../compose.ts";

const bindings: Record<string, Array<{ appId: string; rpcUrl: string; skillId: string; priority: number }>> = {
  "tenant-a product.below-detail": [
    { appId: "app_1", rpcUrl: "https://stars.example/a2a", skillId: "review-stars", priority: 10 },
    { appId: "app_2", rpcUrl: "https://slow.example/a2a", skillId: "slow", priority: 20 },
    { appId: "app_3", rpcUrl: "https://broken.example/a2a", skillId: "broken", priority: 30 },
  ],
};

const registry = {
  tenancy: { resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" })[request.host], findTenant: async () => ({ name: "Shop" }) },
  catalog: { listProducts: async () => [{ productId: "p-lead", handle: "rope-lead", title: "Rope lead", priceMinor: 1800, currencyCode: "GBP" }] },
  pages: { findPage: async () => undefined },
  apps: { listBindings: async (query: { tenantId: string; slotName: string }) => bindings[`${query.tenantId} ${query.slotName}`] ?? [] },
};

const replies: Record<string, () => Promise<string>> = {
  "https://stars.example/a2a": async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result: { message: { messageId: "m", role: "ROLE_AGENT", parts: [{ text: '<p class="stars" onclick="steal()">★★★★☆</p><script>steal()</script>' }] } } }),
  "https://slow.example/a2a": () => new Promise((resolve) => setTimeout(() => resolve("{}"), 2000)),
  "https://broken.example/a2a": async () => Promise.reject(new Error("connection refused")),
};

async function fetchPage(host: string) {
  const app = await composeServer({
    readUptime: () => 0,
    registry,
    capabilities: {},
    merchantToken: "",
    identity: { verifyToken: async () => undefined },
    identityEnabled: false,
    appAccess: { sendRequest: async (request) => ({ status: 200, headers: {}, bodyText: await (replies[request.url] ?? (async () => "{}"))() }), lookupAddress: async () => [], authoriser: { decideApp: async () => "pending" } },
  });
  const started = Date.now();
  const response = await app.request("/products/rope-lead", { headers: { host } });
  return { status: response.status, html: await response.text(), elapsed: Date.now() - started };
}

test("an app's fragment is shown cleaned in its slot, while slow and broken apps add nothing", async () => {
  const page = await fetchPage("shop-a.example");
  assert.equal(page.status, 200);
  assert.match(page.html, /<section class="app-slot"><div id="slot-product-below-detail-app_1" data-slot="product.below-detail" data-app="app_1"><p class="stars">★★★★☆<\/p><\/div><\/section>/);
  assert.doesNotMatch(page.html, /onclick|<script|app_2|app_3/);
  assert.ok(page.elapsed < 1500, `page took ${page.elapsed} ms`);
});

test("another store's bindings never show", async () => {
  const page = await fetchPage("shop-b.example");
  assert.doesNotMatch(page.html, /app-slot/);
});
