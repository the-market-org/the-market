/**
 * Runs only when DATABASE_URL (the owner) and TENANCY_DATABASE_URL (the module's own role, from
 * `.env.module-roles`) are set. The policies bind the module's role, not the owner.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildTenancyDatabase } from "./prisma-tenancy-database.ts";

const ownerUrl = process.env.DATABASE_URL;
const roleUrl = process.env.TENANCY_DATABASE_URL;

test("as the tenancy role, a store is seen only by its id, host or slug, and no query lists the others", { skip: ownerUrl === undefined || roleUrl === undefined }, async () => {
  const asRole = buildModuleDatabaseUrl({ databaseUrl: String(roleUrl), schemaName: "tenancy" });
  const database = buildTenancyDatabase({ databaseUrl: asRole });
  const unscoped = new PrismaClient({ datasourceUrl: asRole });
  const owner = new PrismaClient({ datasourceUrl: buildModuleDatabaseUrl({ databaseUrl: String(ownerUrl), schemaName: "tenancy" }) });
  const slug = `rls-${randomUUID().slice(0, 8)}`;
  const primaryHost = `${slug}.example`;
  try {
    const created = await database.insertTenant({ slug, name: "RLS shop", primaryHost });
    assert.equal((await database.findTenantByHost({ host: primaryHost }))?.tenantId, created.tenantId);
    assert.equal((await database.findTenantBySlug({ slug }))?.tenantId, created.tenantId);
    assert.equal((await database.findTenantById({ tenantId: created.tenantId }))?.slug, slug);
    assert.equal(await database.findTenantByHost({ host: "nobody.example" }), undefined);
    assert.deepEqual(await unscoped.tenant.findMany({ select: { tenantId: true } }), [], "with nothing named, no store is visible");
    await assert.rejects(unscoped.tenant.create({ data: { slug: `${slug}-x`, name: "X", primaryHost: `x.${primaryHost}` } }), "creating a store needs app.create_store");
    assert.ok((await owner.tenant.count()) > 0, "the owner, for migrations, is not bound");
  } finally {
    await owner.tenant.deleteMany({ where: { slug: { startsWith: slug } } });
    await Promise.all([database.disconnect(), unscoped.$disconnect(), owner.$disconnect()]);
  }
});
