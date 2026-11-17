import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "./compose.ts";

const ropeLead = {
  productId: "prod_1",
  handle: "rope-lead",
  title: "Rope lead",
  status: "active",
  priceMinor: 1800,
  currencyCode: "GBP",
};

const hostTenants: Record<string, string> = { "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" };

const fakeRegistry = {
  tenancy: { resolveTenant: async (request: { host: string }) => hostTenants[request.host] },
  catalog: {
    listProducts: async (request: { tenantId: string }) => (request.tenantId === "tenant-a" ? [ropeLead] : []),
  },
};

function requestProducts(host: string): Promise<Response> {
  return composeServer({ readUptime: () => 0, registry: fakeRegistry }).then((app) =>
    app.request("/api/products", { headers: { host } }),
  );
}

test("GET /api/products lists the products of the store that owns the host", async () => {
  const response = await requestProducts("shop-a.example");

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.deepEqual(await response.json(), { products: [ropeLead] });
});

test("a store with no products answers an empty list", async () => {
  const response = await requestProducts("shop-b.example");

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '{"products":[]}');
});

test("an unknown host answers 404", async () => {
  assert.equal((await requestProducts("nobody.example")).status, 404);
});
