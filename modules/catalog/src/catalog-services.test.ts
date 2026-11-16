import assert from "node:assert/strict";
import { test } from "node:test";
import { addProduct, buildCatalogServices } from "./catalog-services.ts";
import type { CatalogDatabase, NewProduct, ProductSummary } from "./catalog-services.ts";

function buildFakeDatabase(): CatalogDatabase {
  const stored: ProductSummary[] = [];
  return {
    findProducts: async () => [...stored],
    insertProduct: async (product) => {
      const summary = { ...product, productId: `prod_${stored.length + 1}`, status: "active" };
      stored.push(summary);
      return summary;
    },
  };
}

test("addProduct stores the product, publishes an event and lists it", async () => {
  const published: Array<[string, unknown]> = [];
  const services = buildCatalogServices({
    database: buildFakeDatabase(),
    publishEvent: async (eventName, payload) => {
      published.push([eventName, payload]);
    },
    addOne: addProduct,
  }) as {
    addProduct: (product: NewProduct) => Promise<ProductSummary>;
    listProducts: () => Promise<ProductSummary[]>;
  };

  const created = await services.addProduct({
    handle: "rope-lead",
    title: "Rope lead",
    sku: "LEAD-1",
    priceMinor: 1200,
    currencyCode: "GBP",
  });

  assert.equal(created.productId, "prod_1");
  assert.deepEqual(published, [["catalog.product.created", { productId: "prod_1" }]]);
  assert.deepEqual(
    (await services.listProducts()).map((product) => product.handle),
    ["rope-lead"],
  );
});
