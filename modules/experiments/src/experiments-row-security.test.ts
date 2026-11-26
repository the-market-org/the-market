/**
 * Runs only when DATABASE_URL (the owner) and EXPERIMENTS_DATABASE_URL (the module's own role, from
 * `.env.module-roles`) are set. The policies bind the module's role, not the owner.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildExperimentsDatabase } from "./prisma-experiments-database.ts";

const ownerUrl = process.env.DATABASE_URL;
const roleUrl = process.env.EXPERIMENTS_DATABASE_URL;

test("as the experiments role, the raw metric query counts only the tenant it names", { skip: ownerUrl === undefined || roleUrl === undefined }, async () => {
  const asRole = buildModuleDatabaseUrl({ databaseUrl: String(roleUrl), schemaName: "experiments" });
  const database = buildExperimentsDatabase({ databaseUrl: asRole });
  const unscoped = new PrismaClient({ datasourceUrl: asRole });
  const owner = new PrismaClient({ datasourceUrl: buildModuleDatabaseUrl({ databaseUrl: String(ownerUrl), schemaName: "experiments" }) });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  try {
    const experiment = await database.insertExperiment({ tenantId: tenantA, name: "Delivery note", pageKey: "product", variantChangeSetId: randomUUID(), goalMetric: "add_to_cart", guardrailMetric: "checkout_paid", trafficPercent: 50, endsAt: "2026-12-10T00:00:00.000Z" });
    const keys = { tenantId: tenantA, experimentId: experiment.experimentId };
    await database.recordExposure({ ...keys, visitorKey: "v1", arm: "variant" });
    await database.insertEvent({ tenantId: tenantA, visitorKey: "v1", eventName: "add_to_cart", pageKey: "product" });
    assert.deepEqual(await database.countMetric({ ...keys, eventName: "add_to_cart" }), { control: { visitors: 0, conversions: 0 }, variant: { visitors: 1, conversions: 1 } });
    assert.deepEqual(await database.countMetric({ tenantId: tenantB, experimentId: experiment.experimentId, eventName: "add_to_cart" }), { control: { visitors: 0, conversions: 0 }, variant: { visitors: 0, conversions: 0 } });
    assert.equal(await database.findRunningExperiment({ tenantId: tenantB, pageKey: "product" }), undefined);
    assert.deepEqual(await unscoped.$queryRaw`SELECT count(*)::int AS rows FROM exposures WHERE experiment_id = ${experiment.experimentId}::uuid`, [{ rows: 0 }], "raw SQL without the tenant set sees nothing");
  } finally {
    await owner.exposure.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await owner.telemetryEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await owner.experiment.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await Promise.all([database.disconnect(), unscoped.$disconnect(), owner.$disconnect()]);
  }
});
