/**
 * Runs only when DATABASE_URL is set (CI provides a PostgreSQL service).
 * Requires `pnpm db apps migrate deploy` to have run first.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildAppsDatabase } from "./prisma-apps-database.ts";

const databaseUrl = process.env.DATABASE_URL;

test("apps and bindings belong to one store, and only active apps fill slots", { skip: databaseUrl === undefined }, async () => {
  const moduleUrl = buildModuleDatabaseUrl({ databaseUrl: String(databaseUrl), schemaName: "apps" });
  const database = buildAppsDatabase({ databaseUrl: moduleUrl });
  const client = new PrismaClient({ datasourceUrl: moduleUrl });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const app = { tenantId: tenantA, baseUrl: "https://reviews.example", name: "Reviews", rpcUrl: "https://reviews.example/a2a", slotSkills: ["review-stars"], permissions: ["read:products"], status: "pending" };
  try {
    const installed = await database.insertApp(app);
    const keys = { tenantId: tenantA, appId: installed.appId };
    assert.deepEqual((await database.findAppByUrl({ tenantId: tenantA, baseUrl: app.baseUrl }))?.appId, installed.appId);
    assert.equal(await database.findApp({ tenantId: tenantB, appId: installed.appId }), undefined);
    assert.equal(await database.findApp({ tenantId: tenantA, appId: "not-a-uuid" }), undefined);

    const binding = { ...keys, slotName: "product.below-detail", skillId: "review-stars", priority: 100 };
    await database.setBinding(binding);
    assert.deepEqual(await database.listBindings({ tenantId: tenantA, slotName: "product.below-detail" }), [], "a pending app fills no slot");

    assert.equal(await database.updateAppStatus({ ...keys, fromStatus: "pending", toStatus: "active" }), 1);
    assert.equal(await database.updateAppStatus({ ...keys, fromStatus: "pending", toStatus: "refused" }), 0);
    await database.setBinding({ ...binding, priority: 50 });
    assert.deepEqual(await database.listBindings({ tenantId: tenantA, slotName: "product.below-detail" }), [
      { appId: installed.appId, appName: "Reviews", rpcUrl: "https://reviews.example/a2a", slotName: "product.below-detail", skillId: "review-stars", priority: 50 },
    ]);
    assert.deepEqual(await database.listBindings({ tenantId: tenantB, slotName: "product.below-detail" }), []);
    assert.deepEqual(await database.findBinding(binding), { skillId: "review-stars", priority: 50 });

    await database.removeBinding(binding);
    assert.equal(await database.findBinding(binding), undefined);
    assert.deepEqual((await database.listApps({ tenantId: tenantA })).map((stored) => stored.status), ["active"]);
  } finally {
    await client.appSlotBinding.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await client.app.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await Promise.all([client.$disconnect(), database.disconnect()]);
  }
});
