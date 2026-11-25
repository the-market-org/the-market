/**
 * Runs only when DATABASE_URL is set (CI provides a PostgreSQL service).
 * Requires `pnpm db tenancy migrate deploy` to have run first.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildTenancyDatabase } from "./prisma-tenancy-database.ts";

const databaseUrl = process.env.DATABASE_URL;

test("a tenant is stored and found by host in the tenancy schema only", { skip: databaseUrl === undefined }, async () => {
  const moduleUrl = buildModuleDatabaseUrl({ databaseUrl: String(databaseUrl), schemaName: "tenancy" });
  const database = buildTenancyDatabase({ databaseUrl: moduleUrl });
  const client = new PrismaClient({ datasourceUrl: moduleUrl });
  const slug = `shop-${Date.now()}`;
  const primaryHost = `${slug}.example`;
  try {
    const created = await database.insertTenant({ slug, name: "Test shop", primaryHost });
    assert.equal(created.status, "active");

    const found = await database.findTenantByHost({ host: primaryHost });
    assert.equal(found?.tenantId, created.tenantId);
    assert.equal(await database.findTenantByHost({ host: "nobody.example" }), undefined);
    assert.equal((await database.findTenantById({ tenantId: created.tenantId }))?.primaryHost, primaryHost);
    assert.equal(await database.findTenantById({ tenantId: "not-a-uuid" }), undefined);
    assert.equal((await database.findTenantBySlug({ slug: created.slug }))?.tenantId, created.tenantId);
    assert.equal(await database.findTenantBySlug({ slug: "no-such-store-slug" }), undefined);

    const tableRows = await client.$queryRaw<Array<{ table_schema: string }>>`
      select table_schema from information_schema.tables where table_name = 'tenant'`;
    assert.deepEqual([...new Set(tableRows.map((tableRow) => tableRow.table_schema))], ["tenancy"]);
  } finally {
    await client.tenant.deleteMany({ where: { slug } });
    await Promise.all([client.$disconnect(), database.disconnect()]);
  }
});
