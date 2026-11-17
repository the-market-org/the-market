/**
 * Creates the demo store and its six demo products. Safe to run again.
 * Usage: pnpm seed (set STORE_HOST to seed another host; default localhost)
 */
import { resolveService } from "@the-market/core";
import type { NewProduct, ProductSummary } from "../modules/catalog/src/index.ts";
import { SEED_PRODUCTS, seedCatalog } from "../modules/catalog/src/index.ts";
import { composeModules } from "../apps/server/src/compose-modules.ts";

type EnsureTenant = (input: { slug: string; name: string; primaryHost: string }) => Promise<{ tenantId: string }>;

/** Ensures the demo tenant for a host, seeds its catalog and reports how many products were added. */
export async function runSeed(input: {
  storeHost: string;
  ensureTenant: EnsureTenant;
  seedProducts: (input: { tenantId: string }) => Promise<number>;
  writeLine: (line: string) => void;
}): Promise<void> {
  const tenant = await input.ensureTenant({ slug: "demo", name: "Demo store", primaryHost: input.storeHost });
  const addedCount = await input.seedProducts({ tenantId: tenant.tenantId });
  input.writeLine(`Seeded ${addedCount} products for ${input.storeHost}`);
}

/** Returns the database URL, or stops with a message saying where to set it. */
export function readDatabaseUrl(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add it to .env in the repository root.");
  }
  return databaseUrl;
}

/** Composition: loads the modules against the database and runs the seed. */
async function seedDatabase(input: { databaseUrl: string | undefined; storeHost: string }): Promise<void> {
  const registry = await composeModules({ databaseUrl: readDatabaseUrl(input.databaseUrl) });
  const listProducts = resolveService({ registry, moduleName: "catalog", serviceName: "listProducts" });
  const addProduct = resolveService({ registry, moduleName: "catalog", serviceName: "addProduct" });
  await runSeed({
    storeHost: input.storeHost,
    ensureTenant: resolveService({ registry, moduleName: "tenancy", serviceName: "ensureTenant" }) as EnsureTenant,
    seedProducts: (request) =>
      seedCatalog({
        tenantId: request.tenantId,
        seedProducts: SEED_PRODUCTS,
        listProducts: listProducts as (request: { tenantId: string }) => Promise<ProductSummary[]>,
        addProduct: addProduct as (product: NewProduct) => Promise<ProductSummary>,
      }),
    writeLine: (line) => console.log(line),
  });
}

if (import.meta.main) {
  await seedDatabase({ databaseUrl: process.env.DATABASE_URL, storeHost: process.env.STORE_HOST ?? "localhost" });
  process.exit(0);
}
