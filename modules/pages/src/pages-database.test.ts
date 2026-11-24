/**
 * Runs only when DATABASE_URL is set (CI provides a PostgreSQL service).
 * Requires `pnpm db pages migrate deploy` to have run first.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildPagesDatabase } from "./prisma-pages-database.ts";

const databaseUrl = process.env.DATABASE_URL;

test("pages are saved per tenant, replaced on save, and removed", { skip: databaseUrl === undefined }, async () => {
  const moduleUrl = buildModuleDatabaseUrl({ databaseUrl: String(databaseUrl), schemaName: "pages" });
  const database = buildPagesDatabase({ databaseUrl: moduleUrl });
  const client = new PrismaClient({ datasourceUrl: moduleUrl });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const hero = { sectionType: "hero", settings: { heading: "Leads for every walk" } };
  const grid = { sectionType: "product-grid", settings: { heading: "Shop" } };
  try {
    await database.savePage({ tenantId: tenantA, pageKey: "home", sections: [hero, grid] });
    assert.deepEqual(await database.findPage({ tenantId: tenantA, pageKey: "home" }), [hero, grid]);
    assert.equal(await database.findPage({ tenantId: tenantB, pageKey: "home" }), undefined);

    await database.savePage({ tenantId: tenantA, pageKey: "home", sections: [grid] });
    assert.deepEqual(await database.findPage({ tenantId: tenantA, pageKey: "home" }), [grid]);

    await database.removePage({ tenantId: tenantB, pageKey: "home" });
    assert.deepEqual(await database.findPage({ tenantId: tenantA, pageKey: "home" }), [grid]);
    await database.removePage({ tenantId: tenantA, pageKey: "home" });
    assert.equal(await database.findPage({ tenantId: tenantA, pageKey: "home" }), undefined);
  } finally {
    await client.page.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await Promise.all([client.$disconnect(), database.disconnect()]);
  }
});
