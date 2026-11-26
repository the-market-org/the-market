/**
 * Runs only when DATABASE_URL is set (CI provides a PostgreSQL service).
 * Requires `pnpm db connections migrate deploy` to have run first.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { buildConnectionsDatabase } from "./prisma-connections-database.ts";
import { PrismaClient } from "./generated/client/index.js";

const databaseUrl = process.env.DATABASE_URL;

test("one connection per store: saved, replaced, found only by its store, removed", { skip: databaseUrl === undefined }, async () => {
  const moduleUrl = buildModuleDatabaseUrl({ databaseUrl: String(databaseUrl), schemaName: "connections" });
  const database = buildConnectionsDatabase({ databaseUrl: moduleUrl });
  const client = new PrismaClient({ datasourceUrl: moduleUrl });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const target = { eventsUrl: "https://agent.example/hook", eventNames: ["changes.change-set.moved"], signingSecret: "test-secret" };
  try {
    await database.saveConnection({ tenantId: tenantA, ...target });
    assert.deepEqual(await database.findConnection({ tenantId: tenantA }), target);
    assert.equal(await database.findConnection({ tenantId: tenantB }), undefined);

    await database.saveConnection({ tenantId: tenantA, ...target, eventNames: [] });
    assert.deepEqual((await database.findConnection({ tenantId: tenantA }))?.eventNames, []);

    await database.removeConnection({ tenantId: tenantB });
    assert.notEqual(await database.findConnection({ tenantId: tenantA }), undefined);
    await database.removeConnection({ tenantId: tenantA });
    assert.equal(await database.findConnection({ tenantId: tenantA }), undefined);

    const first = await database.insertMessage({ tenantId: tenantA, text: "first" });
    await database.insertMessage({ tenantId: tenantA, text: "second" });
    assert.deepEqual((await database.listMessages({ tenantId: tenantA, limit: 10 })).map((message) => message.text), ["second", "first"]);
    assert.deepEqual((await database.listMessages({ tenantId: tenantA, limit: 1 })).length, 1);
    assert.deepEqual(await database.listMessages({ tenantId: tenantB, limit: 10 }), []);
    assert.match(first.sentAt, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    await client.merchantMessage.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await client.agentConnection.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await Promise.all([client.$disconnect(), database.disconnect()]);
  }
});
