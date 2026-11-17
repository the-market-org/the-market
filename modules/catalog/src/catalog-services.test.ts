import assert from "node:assert/strict";
import { test } from "node:test";
import { addProduct, buildCatalogServices } from "./catalog-services.ts";
import type { CatalogDatabase, NewProduct, ProductSummary } from "./catalog-services.ts";

interface CatalogServices {
  addProduct: (product: NewProduct) => Promise<ProductSummary>;
  listProducts: (input: { tenantId: string }) => Promise<ProductSummary[]>;
}

/** Array-backed fake that, like the real adapter, only ever returns one tenant's rows. */
function buildFakeDatabase(): CatalogDatabase {
  const stored: Array<ProductSummary & { tenantId: string }> = [];
  return {
    findProducts: async (input) => stored.filter((product) => product.tenantId === input.tenantId),
    insertProduct: async (product) => {
      const summary = { ...product, productId: `prod_${stored.length + 1}`, status: "active" };
      stored.push(summary);
      return summary;
    },
  };
}

function buildServices(published: Array<[string, unknown]>): CatalogServices {
  return buildCatalogServices({
    database: buildFakeDatabase(),
    publishEvent: async (eventName, payload) => {
      published.push([eventName, payload]);
    },
    addOne: addProduct,
  }) as unknown as CatalogServices;
}

const ropeLead = { handle: "rope-lead", title: "Rope lead", sku: "LEAD-1", priceMinor: 1200, currencyCode: "GBP" };

test("addProduct stores the product, publishes an event with its tenant and lists it", async () => {
  const published: Array<[string, unknown]> = [];
  const services = buildServices(published);

  const created = await services.addProduct({ ...ropeLead, tenantId: "tenant-a" });

  assert.equal(created.productId, "prod_1");
  assert.deepEqual(published, [["catalog.product.created", { tenantId: "tenant-a", productId: "prod_1" }]]);
  assert.deepEqual(
    (await services.listProducts({ tenantId: "tenant-a" })).map((product) => product.handle),
    ["rope-lead"],
  );
});

test("listProducts never returns another tenant's products", async () => {
  const services = buildServices([]);
  await services.addProduct({ ...ropeLead, tenantId: "tenant-a" });

  assert.deepEqual(await services.listProducts({ tenantId: "tenant-b" }), []);
});
