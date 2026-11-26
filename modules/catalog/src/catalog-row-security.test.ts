/**
 * Runs only when DATABASE_URL (the owner) and CATALOG_DATABASE_URL (the module's own role, from
 * `.env.module-roles`) are set. The policies bind the module's role, not the owner.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildModuleDatabaseUrl, readQueryTenant } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildCatalogDatabase, summariseProduct } from "./prisma-catalog-database.ts";

const ownerUrl = process.env.DATABASE_URL;
const roleUrl = process.env.CATALOG_DATABASE_URL;

test("the tenant id a query names is read from where or data, and nothing else counts", () => {
  assert.equal(readQueryTenant({ where: { tenantId: "tenant-a" } }), "tenant-a");
  assert.equal(readQueryTenant({ data: { tenantId: "tenant-b" } }), "tenant-b");
  assert.equal(readQueryTenant({ where: {} }), "");
  assert.equal(readQueryTenant(undefined), "");
});

test("as the catalog role, a query sees only the tenant it names, and a query that names none sees nothing", { skip: ownerUrl === undefined || roleUrl === undefined }, async () => {
  const asRole = buildModuleDatabaseUrl({ databaseUrl: String(roleUrl), schemaName: "catalog" });
  const database = buildCatalogDatabase({ databaseUrl: asRole, summarise: summariseProduct });
  const unscoped = new PrismaClient({ datasourceUrl: asRole });
  const owner = new PrismaClient({ datasourceUrl: buildModuleDatabaseUrl({ databaseUrl: String(ownerUrl), schemaName: "catalog" }) });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  try {
    const product = await database.insertProduct({ tenantId: tenantA, handle: "lead", title: "Lead", sku: `lead-${tenantA}`, priceMinor: 1800, currencyCode: "GBP" });
    assert.deepEqual((await database.findProducts({ tenantId: tenantA })).map((found) => found.productId), [product.productId]);
    assert.deepEqual(await database.findProducts({ tenantId: tenantB }), []);
    assert.equal(await database.findProductById({ tenantId: tenantB, productId: product.productId }), undefined);
    const forgotten = await unscoped.product.findMany({ where: { handle: "lead", productId: product.productId } });
    assert.deepEqual(forgotten, [], "a query that forgets its tenant filter sees no rows at all");
    await assert.rejects(unscoped.product.create({ data: { tenantId: tenantB, handle: "x", title: "X", status: "active" } }), "writing without the tenant set is refused");
    assert.equal(await owner.product.count({ where: { tenantId: tenantA } }), 1, "the owner, for migrations, is not bound");
  } finally {
    await owner.variant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await owner.product.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await Promise.all([database.disconnect(), unscoped.$disconnect(), owner.$disconnect()]);
  }
});
