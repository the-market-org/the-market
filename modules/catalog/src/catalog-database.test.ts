/**
 * Runs only when DATABASE_URL is set (CI provides a PostgreSQL service).
 * Requires `pnpm db catalog migrate deploy` to have run first.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildCatalogDatabase, summariseProduct } from "./prisma-catalog-database.ts";

const databaseUrl = process.env.DATABASE_URL;

test("catalog products are stored and listed from the catalog schema only", { skip: databaseUrl === undefined }, async () => {
  const moduleUrl = buildModuleDatabaseUrl({ databaseUrl: String(databaseUrl), schemaName: "catalog" });
  const database = buildCatalogDatabase({ databaseUrl: moduleUrl, summarise: summariseProduct });
  const client = new PrismaClient({ datasourceUrl: moduleUrl });
  const handle = `lead-${Date.now()}`;
  try {
    const created = await database.insertProduct({
      handle,
      title: "Lead",
      sku: handle,
      priceMinor: 1200,
      currencyCode: "GBP",
    });
    assert.equal(created.status, "active");

    const listed = (await database.findProducts()).find((product) => product.handle === handle);
    assert.deepEqual(listed, { ...created, priceMinor: 1200, currencyCode: "GBP" });

    const tableRows = await client.$queryRaw<Array<{ table_schema: string }>>`
      select table_schema from information_schema.tables where table_name in ('products', 'variants')`;
    assert.deepEqual([...new Set(tableRows.map((tableRow) => tableRow.table_schema))], ["catalog"]);
  } finally {
    await client.variant.deleteMany({ where: { sku: handle } });
    await client.product.deleteMany({ where: { handle } });
    await Promise.all([client.$disconnect(), database.disconnect()]);
  }
});
