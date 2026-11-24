/**
 * Runs only when DATABASE_URL is set (CI provides a PostgreSQL service).
 * Requires `pnpm db catalog migrate deploy` to have run first.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildCatalogDatabase, summariseProduct } from "./prisma-catalog-database.ts";

const databaseUrl = process.env.DATABASE_URL;

test("two tenants can share a handle and SKU and each sees only its own product", { skip: databaseUrl === undefined }, async () => {
  const moduleUrl = buildModuleDatabaseUrl({ databaseUrl: String(databaseUrl), schemaName: "catalog" });
  const database = buildCatalogDatabase({ databaseUrl: moduleUrl, summarise: summariseProduct });
  const client = new PrismaClient({ datasourceUrl: moduleUrl });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const shared = { handle: "rope-lead", sku: "LEAD-ROPE", priceMinor: 1800, currencyCode: "GBP" };
  try {
    const productA = await database.insertProduct({ ...shared, tenantId: tenantA, title: "Lead A" });
    const productB = await database.insertProduct({ ...shared, tenantId: tenantB, title: "Lead B" });
    assert.equal(productA.status, "active");

    assert.deepEqual(await database.findProducts({ tenantId: tenantA }), [productA]);
    assert.deepEqual(await database.findProducts({ tenantId: tenantB }), [productB]);

    const tableRows = await client.$queryRaw<Array<{ table_schema: string }>>`
      select table_schema from information_schema.tables where table_name in ('products', 'variants')`;
    assert.deepEqual([...new Set(tableRows.map((tableRow) => tableRow.table_schema))], ["catalog"]);
  } finally {
    await client.variant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await client.product.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await Promise.all([client.$disconnect(), database.disconnect()]);
  }
});

test("renaming with another tenant's id changes no row and leaves the title", { skip: databaseUrl === undefined }, async () => {
  const moduleUrl = buildModuleDatabaseUrl({ databaseUrl: String(databaseUrl), schemaName: "catalog" });
  const database = buildCatalogDatabase({ databaseUrl: moduleUrl, summarise: summariseProduct });
  const client = new PrismaClient({ datasourceUrl: moduleUrl });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  try {
    const productA = await database.insertProduct({
      tenantId: tenantA,
      handle: "rope-lead",
      title: "Lead A",
      sku: "LEAD-ROPE",
      priceMinor: 1800,
      currencyCode: "GBP",
    });

    assert.equal(await database.updateProductTitle({ tenantId: tenantB, productId: productA.productId, title: "Taken" }), 0);
    assert.equal(await database.findProductById({ tenantId: tenantB, productId: productA.productId }), undefined);
    assert.equal((await database.findProductById({ tenantId: tenantA, productId: productA.productId }))?.title, "Lead A");

    assert.equal(await database.findProductById({ tenantId: tenantA, productId: "p1" }), undefined);
    assert.equal(await database.updateProductTitle({ tenantId: tenantA, productId: "p1", title: "Taken" }), 0);

    assert.equal(await database.updateProductTitle({ tenantId: tenantA, productId: productA.productId, title: "Lead B" }), 1);
    assert.equal((await database.findProductById({ tenantId: tenantA, productId: productA.productId }))?.title, "Lead B");
  } finally {
    await client.variant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await client.product.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await Promise.all([client.$disconnect(), database.disconnect()]);
  }
});
