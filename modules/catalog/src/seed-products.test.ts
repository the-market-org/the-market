import assert from "node:assert/strict";
import { test } from "node:test";
import type { NewProduct, ProductSummary } from "./catalog-services.ts";
import { SEED_PRODUCTS, seedCatalog } from "./seed-products.ts";

/** Array-backed stand-ins for the catalog services, scoped by tenant like the real ones. */
function buildFakeCatalog() {
  const stored: Array<ProductSummary & { tenantId: string }> = [];
  return {
    listProducts: async (input: { tenantId: string }) =>
      stored.filter((product) => product.tenantId === input.tenantId),
    addProduct: async (product: NewProduct) => {
      const summary = { ...product, productId: `prod_${stored.length + 1}`, status: "active" };
      stored.push(summary);
      return summary;
    },
  };
}

function seedTenant(catalog: ReturnType<typeof buildFakeCatalog>): Promise<number> {
  return seedCatalog({ tenantId: "tenant-a", seedProducts: SEED_PRODUCTS, ...catalog });
}

test("seeding an empty tenant adds the six demo products", async () => {
  const catalog = buildFakeCatalog();

  assert.equal(await seedTenant(catalog), 6);
  assert.deepEqual(
    (await catalog.listProducts({ tenantId: "tenant-a" })).map((product) => product.handle),
    ["rope-lead", "leather-collar", "treat-pouch", "travel-bowl", "chew-toy", "drying-towel"],
  );
});

test("seeding twice adds nothing the second time", async () => {
  const catalog = buildFakeCatalog();
  await seedTenant(catalog);

  assert.equal(await seedTenant(catalog), 0);
});

test("seeding skips a product whose handle already exists", async () => {
  const catalog = buildFakeCatalog();
  await catalog.addProduct({
    tenantId: "tenant-a",
    handle: "rope-lead",
    title: "My own lead",
    sku: "MINE-1",
    priceMinor: 999,
    currencyCode: "GBP",
  });

  assert.equal(await seedTenant(catalog), 5);
});

test("the demo products are priced in pence, in pounds sterling", () => {
  assert.deepEqual(
    SEED_PRODUCTS.map((product) => [product.sku, product.priceMinor, product.currencyCode]),
    [
      ["LEAD-ROPE", 1800, "GBP"],
      ["COLLAR-LEATHER", 2400, "GBP"],
      ["POUCH-TREAT", 1200, "GBP"],
      ["BOWL-TRAVEL", 900, "GBP"],
      ["TOY-CHEW", 700, "GBP"],
      ["TOWEL-DRY", 1500, "GBP"],
    ],
  );
});
