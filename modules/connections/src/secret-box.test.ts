import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { buildSealedDatabase } from "./prisma-connections-database.ts";
import { isSealed, openSecret, readSecretsKey, readStoredSecret, sealSecret } from "./secret-box.ts";
import type { ConnectionsDatabase } from "./connections-types.ts";

const key = randomBytes(32);

test("a sealed secret opens with its key, and fails with another key or a changed value", () => {
  const stored = sealSecret({ plain: "signing-secret-1", key });
  assert.match(stored, /^v1:[\w-]+:[\w-]+:[\w-]+$/);
  assert.doesNotMatch(stored, /signing-secret-1/);
  assert.notEqual(sealSecret({ plain: "signing-secret-1", key }), stored, "a new IV every time");
  assert.equal(openSecret({ stored, key }), "signing-secret-1");
  assert.throws(() => openSecret({ stored, key: randomBytes(32) }));
  const parts = stored.split(":");
  const ciphertext = Buffer.from(String(parts[3]), "base64url");
  ciphertext[0] = (ciphertext[0] ?? 0) ^ 0xff;
  const changed = [...parts.slice(0, 3), ciphertext.toString("base64url")].join(":");
  assert.notEqual(changed, stored);
  assert.throws(() => openSecret({ stored: changed, key }));
});

test("older plain secrets are read as they are; a sealed one needs the key", () => {
  assert.equal(readStoredSecret({ stored: "old-plain", key: undefined, open: openSecret }), "old-plain");
  assert.equal(isSealed("old-plain"), false);
  const stored = sealSecret({ plain: "new", key });
  assert.throws(() => readStoredSecret({ stored, key: undefined, open: openSecret }), { message: "SECRETS_KEY is needed to read the agent connection's signing secret" });
  assert.equal(readStoredSecret({ stored, key, open: openSecret }), "new");
});

test("the key must be 32 bytes in base64", () => {
  assert.equal(readSecretsKey(key.toString("base64")).length, 32);
  assert.throws(() => readSecretsKey("c2hvcnQ="), { message: "SECRETS_KEY must be 32 bytes, base64 encoded" });
});

test("the sealed database stores only sealed secrets and hands back the plain one", async () => {
  const rows = new Map<string, { eventsUrl: string; eventNames: string[]; signingSecret: string }>();
  const inner: ConnectionsDatabase = {
    saveConnection: async (connection) => void rows.set(connection.tenantId, { eventsUrl: connection.eventsUrl, eventNames: connection.eventNames, signingSecret: connection.signingSecret }),
    findConnection: async (query) => rows.get(query.tenantId),
    removeConnection: async (query) => void rows.delete(query.tenantId),
    insertMessage: async () => ({ messageId: "", text: "", sentAt: "" }),
    listMessages: async () => [],
  };
  const database = buildSealedDatabase({ database: inner, seal: (plain) => sealSecret({ plain, key }), read: (stored) => readStoredSecret({ stored, key, open: openSecret }) });
  await database.saveConnection({ tenantId: "tenant-a", eventsUrl: "https://agent.example/hook", eventNames: [], signingSecret: "plain-secret" });
  assert.equal(isSealed(String(rows.get("tenant-a")?.signingSecret)), true);
  assert.equal((await database.findConnection({ tenantId: "tenant-a" }))?.signingSecret, "plain-secret");
  assert.equal(await database.findConnection({ tenantId: "tenant-b" }), undefined);
});
