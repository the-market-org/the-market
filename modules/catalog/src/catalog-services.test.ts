import assert from "node:assert/strict";
import { test } from "node:test";
import { addProduct, buildCatalogServices, renameProduct } from "./catalog-services.ts";
import type { CatalogDatabase, NewProduct, ProductSummary } from "./catalog-services.ts";

interface CatalogServices {
  addProduct: (product: NewProduct) => Promise<ProductSummary>;
  listProducts: (input: { tenantId: string }) => Promise<ProductSummary[]>;
  findProduct: (input: { tenantId: string; productId: string }) => Promise<ProductSummary | undefined>;
  renameProduct: (input: { tenantId: string; productId: string; title: string }) => Promise<void>;
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
    findProductById: async (input) =>
      stored.find((product) => product.tenantId === input.tenantId && product.productId === input.productId),
    updateProductTitle: async (input) => {
      const matching = stored.filter(
        (product) => product.tenantId === input.tenantId && product.productId === input.productId,
      );
      matching.forEach((product) => Object.assign(product, { title: input.title }));
      return matching.length;
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
    renameOne: renameProduct,
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

test("renameProduct changes the title that findProduct then returns", async () => {
  const services = buildServices([]);
  const created = await services.addProduct({ ...ropeLead, tenantId: "tenant-a" });

  await services.renameProduct({ tenantId: "tenant-a", productId: created.productId, title: "Braided lead" });

  assert.equal((await services.findProduct({ tenantId: "tenant-a", productId: created.productId }))?.title, "Braided lead");
});

test("renaming an unknown product, or another tenant's, rejects with Product not found", async () => {
  const services = buildServices([]);
  const created = await services.addProduct({ ...ropeLead, tenantId: "tenant-a" });

  await assert.rejects(services.renameProduct({ tenantId: "tenant-a", productId: "missing", title: "X" }), {
    message: "Product not found",
  });
  await assert.rejects(services.renameProduct({ tenantId: "tenant-b", productId: created.productId, title: "X" }), {
    message: "Product not found",
  });
  assert.equal(await services.findProduct({ tenantId: "tenant-b", productId: created.productId }), undefined);
  assert.equal((await services.findProduct({ tenantId: "tenant-a", productId: created.productId }))?.title, "Rope lead");
});
