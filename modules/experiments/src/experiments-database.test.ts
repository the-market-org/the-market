/**
 * Runs only when DATABASE_URL is set (CI provides a PostgreSQL service).
 * Requires `pnpm db experiments migrate deploy` to have run first.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildExperimentsDatabase } from "./prisma-experiments-database.ts";

const databaseUrl = process.env.DATABASE_URL;

test("experiments, exposures and events belong to one store, and metrics count exposed visitors", { skip: databaseUrl === undefined }, async () => {
  const moduleUrl = buildModuleDatabaseUrl({ databaseUrl: String(databaseUrl), schemaName: "experiments" });
  const database = buildExperimentsDatabase({ databaseUrl: moduleUrl });
  const client = new PrismaClient({ datasourceUrl: moduleUrl });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const plan = { tenantId: tenantA, name: "Delivery note", pageKey: "product", variantChangeSetId: randomUUID(), goalMetric: "add_to_cart", guardrailMetric: "checkout_paid", trafficPercent: 50, endsAt: "2026-12-09T00:00:00.000Z" };
  try {
    const experiment = await database.insertExperiment(plan);
    const keys = { tenantId: tenantA, experimentId: experiment.experimentId };
    assert.equal(experiment.state, "running");
    assert.equal((await database.findRunningExperiment({ tenantId: tenantA, pageKey: "product" }))?.experimentId, experiment.experimentId);
    assert.equal(await database.findRunningExperiment({ tenantId: tenantB, pageKey: "product" }), undefined);
    assert.equal(await database.findExperiment({ tenantId: tenantB, experimentId: experiment.experimentId }), undefined);
    assert.equal(await database.findExperiment({ tenantId: tenantA, experimentId: "not-a-uuid" }), undefined);

    assert.equal(await database.recordExposure({ ...keys, visitorKey: "v1", arm: "variant" }), "variant");
    assert.equal(await database.recordExposure({ ...keys, visitorKey: "v1", arm: "control" }), "variant", "the first arm stays");
    await database.recordExposure({ ...keys, visitorKey: "v2", arm: "control" });
    await database.insertEvent({ tenantId: tenantA, visitorKey: "v1", eventName: "add_to_cart", pageKey: "product" });
    await database.insertEvent({ tenantId: tenantB, visitorKey: "v2", eventName: "add_to_cart", pageKey: "product" });
    assert.deepEqual(await database.countMetric({ ...keys, eventName: "add_to_cart" }), { control: { visitors: 1, conversions: 0 }, variant: { visitors: 1, conversions: 1 } });

    assert.equal(await database.updateExperimentState({ ...keys, fromState: "running", toState: "decided", outcome: { decision: "adopt" } }), 1);
    assert.equal(await database.updateExperimentState({ ...keys, fromState: "running", toState: "stopped" }), 0);
    assert.deepEqual((await database.findExperiment({ ...keys, pageKey: "extra fields are ignored" } as typeof keys))?.outcome, { decision: "adopt" });
    assert.deepEqual((await database.listExperiments({ tenantId: tenantB })).length, 0);
  } finally {
    await client.exposure.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await client.telemetryEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await client.experiment.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await Promise.all([client.$disconnect(), database.disconnect()]);
  }
});
