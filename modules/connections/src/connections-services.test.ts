import assert from "node:assert/strict";
import { test } from "node:test";
import { buildConnectionsServices, describeConnection } from "./connections-services.ts";
import type { ConnectionsDatabase, DeliveryTarget } from "./connections-types.ts";

function buildFakeDatabase(): ConnectionsDatabase {
  const stored = new Map<string, DeliveryTarget>();
  return {
    saveConnection: async (connection) => void stored.set(connection.tenantId, { eventsUrl: connection.eventsUrl, eventNames: connection.eventNames, signingSecret: connection.signingSecret }),
    findConnection: async (query) => stored.get(query.tenantId),
    removeConnection: async (query) => void stored.delete(query.tenantId),
  };
}

type Services = Record<string, (input: Record<string, unknown>) => Promise<any>>;

function buildServices(): Services {
  let secretCount = 0;
  return buildConnectionsServices({
    database: buildFakeDatabase(),
    generateSecret: () => `secret-${(secretCount += 1)}`,
    describe: describeConnection,
  }) as unknown as Services;
}

const connection = { tenantId: "tenant-a", eventsUrl: "https://agent.example/hook", eventNames: ["changes.change-set.moved"] };

test("saving returns a new signing secret once; reading never shows it", async () => {
  const services = buildServices();
  assert.deepEqual(await services.saveConnection?.(connection), { signingSecret: "secret-1" });
  assert.deepEqual(await services.findConnection?.({ tenantId: "tenant-a" }), { eventsUrl: "https://agent.example/hook", eventNames: ["changes.change-set.moved"] });
  assert.deepEqual(await services.saveConnection?.(connection), { signingSecret: "secret-2" });
});

test("the delivery target includes the secret, for the server's event delivery only", async () => {
  const services = buildServices();
  await services.saveConnection?.(connection);
  assert.equal((await services.findDeliveryTarget?.({ tenantId: "tenant-a" }))?.signingSecret, "secret-1");
});

test("another store has no connection, and a removed one is gone", async () => {
  const services = buildServices();
  await services.saveConnection?.(connection);
  assert.equal(await services.findConnection?.({ tenantId: "tenant-b" }), undefined);
  await services.removeConnection?.({ tenantId: "tenant-a" });
  assert.equal(await services.findDeliveryTarget?.({ tenantId: "tenant-a" }), undefined);
});
