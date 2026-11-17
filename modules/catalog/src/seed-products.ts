import type { NewProduct, ProductSummary } from "./catalog-services.ts";

/** A demo product before it is given to a tenant. */
export type SeedProduct = Omit<NewProduct, "tenantId">;

/** The demo catalogue. Prices are in pence. */
export const SEED_PRODUCTS: readonly SeedProduct[] = Object.freeze([
  { handle: "rope-lead", title: "Rope lead", sku: "LEAD-ROPE", priceMinor: 1800, currencyCode: "GBP" },
  { handle: "leather-collar", title: "Leather collar", sku: "COLLAR-LEATHER", priceMinor: 2400, currencyCode: "GBP" },
  { handle: "treat-pouch", title: "Treat pouch", sku: "POUCH-TREAT", priceMinor: 1200, currencyCode: "GBP" },
  { handle: "travel-bowl", title: "Travel bowl", sku: "BOWL-TRAVEL", priceMinor: 900, currencyCode: "GBP" },
  { handle: "chew-toy", title: "Chew toy", sku: "TOY-CHEW", priceMinor: 700, currencyCode: "GBP" },
  { handle: "drying-towel", title: "Drying towel", sku: "TOWEL-DRY", priceMinor: 1500, currencyCode: "GBP" },
]);

/**
 * Adds the seed products a tenant does not have yet, matched by handle.
 * Safe to run any number of times. Returns how many products were added.
 */
export async function seedCatalog(input: {
  tenantId: string;
  seedProducts: readonly SeedProduct[];
  listProducts: (input: { tenantId: string }) => Promise<ProductSummary[]>;
  addProduct: (product: NewProduct) => Promise<ProductSummary>;
}): Promise<number> {
  const existingHandles = new Set(
    (await input.listProducts({ tenantId: input.tenantId })).map((product) => product.handle),
  );
  const missingProducts = input.seedProducts.filter((product) => !existingHandles.has(product.handle));
  for (const product of missingProducts) {
    await input.addProduct({ ...product, tenantId: input.tenantId });
  }
  return missingProducts.length;
}
