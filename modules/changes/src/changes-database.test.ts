/**
 * Runs only when DATABASE_URL is set (CI provides a PostgreSQL service).
 * Requires `pnpm db changes migrate deploy` to have run first.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildChangesDatabase } from "./prisma-changes-database.ts";

const databaseUrl = process.env.DATABASE_URL;

test("change sets are stored per tenant, items in order, and states move only from the stored state", { skip: databaseUrl === undefined }, async () => {
  const moduleUrl = buildModuleDatabaseUrl({ databaseUrl: String(databaseUrl), schemaName: "changes" });
  const database = buildChangesDatabase({ databaseUrl: moduleUrl });
  const client = new PrismaClient({ datasourceUrl: moduleUrl });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  try {
    const changeSet = await database.insertChangeSet({ tenantId: tenantA, title: "Rename leads", proposedBy: "merchant" });
    assert.equal(changeSet.state, "draft");
    const keys = { tenantId: tenantA, changeSetId: changeSet.changeSetId };
    const rename = { capabilityName: "catalog.product.rename", summary: "Rename" };
    await database.insertChangeItem({ ...keys, ...rename, change: { title: "One" }, revert: { title: "Old one" } });
    await database.insertChangeItem({ ...keys, ...rename, change: { title: "Two" }, revert: { title: "Old two" } });

    const found = await database.findChangeSet(keys);
    assert.deepEqual(found?.items.map((item) => [item.position, item.change]), [[0, { title: "One" }], [1, { title: "Two" }]]);
    assert.equal(await database.findChangeSet({ tenantId: tenantB, changeSetId: changeSet.changeSetId }), undefined);

    const move = { fromState: "draft", toState: "approved", approvedBy: "Ruth", failureReason: "" };
    assert.equal(await database.updateState({ tenantId: tenantB, changeSetId: changeSet.changeSetId, ...move }), 0);
    assert.equal(await database.updateState({ ...keys, ...move }), 1);
    assert.equal(await database.updateState({ ...keys, ...move }), 0);
    const approved = await database.findChangeSet(keys);
    assert.deepEqual([approved?.state, approved?.approvedBy, approved?.failureReason], ["approved", "Ruth", ""]);
  } finally {
    await client.changeItem.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await client.changeSet.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await Promise.all([client.$disconnect(), database.disconnect()]);
  }
});
