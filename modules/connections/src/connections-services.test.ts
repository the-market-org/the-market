import assert from "node:assert/strict";
import { test } from "node:test";
import { buildConnectionsServices, checkMessageText, describeConnection } from "./connections-services.ts";
import type { ConnectionsDatabase, DeliveryTarget, MerchantMessage } from "./connections-types.ts";

function buildFakeDatabase(): ConnectionsDatabase {
  const stored = new Map<string, DeliveryTarget>();
  const messages: Array<MerchantMessage & { tenantId: string }> = [];
  return {
    saveConnection: async (connection) => void stored.set(connection.tenantId, { eventsUrl: connection.eventsUrl, eventNames: connection.eventNames, signingSecret: connection.signingSecret }),
    findConnection: async (query) => stored.get(query.tenantId),
    removeConnection: async (query) => void stored.delete(query.tenantId),
    insertMessage: async (message) => {
      const record = { tenantId: message.tenantId, messageId: `msg_${messages.length + 1}`, text: message.text, sentAt: `2026-11-26T00:00:0${messages.length}.000Z` };
      messages.push(record);
      return { messageId: record.messageId, text: record.text, sentAt: record.sentAt };
    },
    listMessages: async (query) => messages.filter((message) => message.tenantId === query.tenantId).reverse().slice(0, query.limit).map(({ tenantId: _tenantId, ...message }) => message),
  };
}

type Services = Record<string, (input: Record<string, unknown>) => Promise<any>>;

function buildServices(published: unknown[] = []): Services {
  let secretCount = 0;
  return buildConnectionsServices({
    database: buildFakeDatabase(),
    generateSecret: () => `secret-${(secretCount += 1)}`,
    describe: describeConnection,
    checkText: checkMessageText,
    publishEvent: async (eventName, payload) => void published.push({ eventName, payload }),
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

test("a merchant message is saved trimmed, published for the agent, and listed newest first for its store only", async () => {
  const published: unknown[] = [];
  const services = buildServices(published);
  const first = await services.sendMessage?.({ tenantId: "tenant-a", text: "  make the home page warmer  " });
  await services.sendMessage?.({ tenantId: "tenant-a", text: "and add delivery info" });
  assert.equal(first.text, "make the home page warmer");
  assert.deepEqual(published[0], { eventName: "merchant.message.sent", payload: { tenantId: "tenant-a", messageId: first.messageId, text: "make the home page warmer" } });
  assert.deepEqual((await services.listMessages?.({ tenantId: "tenant-a" })).map((message: MerchantMessage) => message.text), ["and add delivery info", "make the home page warmer"]);
  assert.deepEqual(await services.listMessages?.({ tenantId: "tenant-b" }), []);
});

test("an empty message, or one of 2001 characters, is refused and nothing is published", async () => {
  const published: unknown[] = [];
  const services = buildServices(published);
  for (const text of ["   ", "x".repeat(2001)]) {
    await assert.rejects(services.sendMessage?.({ tenantId: "tenant-a", text }) as Promise<unknown>, { message: "Invalid input: a message is 1 to 2000 characters" });
  }
  assert.equal((await services.sendMessage?.({ tenantId: "tenant-a", text: "x".repeat(2000) })).text.length, 2000);
  assert.equal(published.length, 1);
});
