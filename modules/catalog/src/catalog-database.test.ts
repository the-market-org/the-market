/**
 * Runs only when DATABASE_URL is set (CI provides a PostgreSQL service).
 * Requires `pnpm db catalog migrate deploy` to have run first.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";

const databaseUrl = process.env.DATABASE_URL;

test("catalog data is stored in the catalog schema only", { skip: databaseUrl === undefined }, async () => {
  const client = new PrismaClient({
    datasourceUrl: buildModuleDatabaseUrl({ databaseUrl: String(databaseUrl), schemaName: "catalog" }),
  });
  const handle = `lead-${Date.now()}`;
  try {
    const product = await client.product.create({
      data: {
        handle,
        title: "Lead",
        variants: { create: { sku: handle, title: "Default", priceMinor: 1200, currencyCode: "GBP" } },
      },
      include: { variants: true },
    });
    assert.equal(product.status, "draft");
    assert.equal(product.variants[0]?.priceMinor, 1200);

    const tableRows = await client.$queryRaw<Array<{ table_schema: string }>>`
      select table_schema from information_schema.tables where table_name in ('products', 'variants')`;
    assert.deepEqual([...new Set(tableRows.map((tableRow) => tableRow.table_schema))], ["catalog"]);

    await client.variant.deleteMany({ where: { productId: product.productId } });
    await client.product.delete({ where: { productId: product.productId } });
  } finally {
    await client.$disconnect();
  }
});
