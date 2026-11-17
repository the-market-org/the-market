import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "../compose.ts";

const tenants: Record<string, { tenantId: string; name: string }> = {
  "shop-a.example": { tenantId: "tenant-a", name: "Leads & Co" },
  "shop-b.example": { tenantId: "tenant-b", name: "Shop B" },
};
const products: Record<string, Array<{ handle: string; title: string; priceMinor: number; currencyCode: string }>> = {
  "tenant-a": [
    { handle: "rope-lead", title: "Rope lead", priceMinor: 1800, currencyCode: "GBP" },
    { handle: "chew-toy", title: "Chew toy", priceMinor: 700, currencyCode: "GBP" },
  ],
  "tenant-b": [{ handle: "cat-bed", title: "Cat bed", priceMinor: 3000, currencyCode: "GBP" }],
};
const savedPages: Record<string, unknown> = {
  "tenant-b home": [{ sectionType: "hero", settings: { heading: "Only for shop B" } }],
};

const registry = {
  tenancy: {
    resolveTenant: async (request: { host: string }) => tenants[request.host]?.tenantId,
    findTenant: async (request: { tenantId: string }) => Object.values(tenants).find((tenant) => tenant.tenantId === request.tenantId),
  },
  catalog: { listProducts: async (request: { tenantId: string }) => products[request.tenantId] ?? [] },
  pages: { findPage: async (request: { tenantId: string; pageKey: string }) => savedPages[`${request.tenantId} ${request.pageKey}`] },
};

async function fetchPage(input: { host: string; path: string }): Promise<{ status: number; type: string; html: string }> {
  const app = await composeServer({
    readUptime: () => 0,
    registry,
    capabilities: {},
    merchantToken: "",
    identity: { verifyToken: async () => undefined },
    identityEnabled: false,
  });
  const response = await app.request(input.path, { headers: { host: input.host } });
  return { status: response.status, type: String(response.headers.get("content-type")), html: await response.text() };
}

test("the home page shows the default sections with this store's products only", async () => {
  const page = await fetchPage({ host: "shop-a.example", path: "/" });
  assert.deepEqual([page.status, page.type], [200, "text/html; charset=utf-8"]);
  assert.match(page.html, /<title>Leads &amp; Co<\/title>/);
  assert.match(page.html, /<h1>Welcome<\/h1>/);
  assert.match(page.html, /href="\/products\/rope-lead">Rope lead<\/a> <span>£18.00<\/span>/);
  assert.doesNotMatch(page.html, /Cat bed|Only for shop B/);
});

test("a saved page replaces the defaults for its own store", async () => {
  const page = await fetchPage({ host: "shop-b.example", path: "/" });
  assert.match(page.html, /<h1>Only for shop B<\/h1>/);
  assert.doesNotMatch(page.html, /Welcome/);
});

test("a product page shows the product, and an unknown handle is 404", async () => {
  const found = await fetchPage({ host: "shop-a.example", path: "/products/rope-lead" });
  assert.equal(found.status, 200);
  assert.match(found.html, /<h1>Rope lead<\/h1><p class="price">£18.00<\/p>/);

  const missing = await fetchPage({ host: "shop-a.example", path: "/products/cat-bed" });
  assert.deepEqual([missing.status, missing.type], [404, "text/html; charset=utf-8"]);
  assert.match(missing.html, /Product not found/);
});

test("an unknown host is 404", async () => {
  assert.equal((await fetchPage({ host: "nobody.example", path: "/" })).status, 404);
});
