import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "../compose.ts";
import { checkEventsUrl } from "./connection-routes.ts";

function buildRegistry() {
  const saved = new Map<string, { eventsUrl: string; eventNames: string[] }>();
  return {
    tenancy: { resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" })[request.host], findTenant: async () => ({ name: "Shop" }) },
    catalog: { listProducts: async () => [] },
    pages: { findPage: async () => undefined },
    changes: { createChangeSet: async () => ({}), findChangeSet: async () => undefined, addChangeItem: async () => ({}), moveChangeSet: async () => {} },
    connections: {
      saveConnection: async (request: { tenantId: string; eventsUrl: string; eventNames: string[] }) => (saved.set(request.tenantId, request), { signingSecret: "fresh-secret" }),
      findConnection: async (request: { tenantId: string }) => saved.get(request.tenantId) && { eventsUrl: saved.get(request.tenantId)?.eventsUrl, eventNames: saved.get(request.tenantId)?.eventNames },
      removeConnection: async (request: { tenantId: string }) => void saved.delete(request.tenantId),
    },
  };
}

async function buildClient() {
  const app = await composeServer({ readUptime: () => 0, registry: buildRegistry(), capabilities: {}, merchantToken: "s3cret", identity: { verifyToken: async () => undefined }, identityEnabled: false });
  return (input: { method: string; host?: string; body?: unknown }) =>
    app.request("/api/agent-connection", {
      method: input.method,
      headers: { host: input.host ?? "shop-a.example", authorization: "Bearer s3cret", "content-type": "application/json" },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    });
}

test("a merchant registers, reads and removes the store's agent connection; the secret is shown once", async () => {
  const send = await buildClient();
  const saved = await send({ method: "PUT", body: { eventsUrl: "https://agent.example/hook", eventNames: ["changes.change-set.moved"] } });
  assert.deepEqual([saved.status, await saved.json()], [200, { signingSecret: "fresh-secret" }]);

  const read = await send({ method: "GET" });
  assert.deepEqual([read.status, await read.json()], [200, { eventsUrl: "https://agent.example/hook", eventNames: ["changes.change-set.moved"] }]);
  assert.equal((await send({ method: "GET", host: "shop-b.example" })).status, 404);

  const removed = await send({ method: "DELETE" });
  assert.deepEqual([removed.status, await removed.json()], [200, { removed: true }]);
  assert.equal((await send({ method: "GET" })).status, 404);
});

test("bad connection bodies are refused", async () => {
  const send = await buildClient();
  const plainHttp = await send({ method: "PUT", body: { eventsUrl: "http://agent.example/hook", eventNames: [] } });
  assert.deepEqual([plainHttp.status, await plainHttp.json()], [400, { error: "Invalid input: eventsUrl must use https" }]);
  const badNames = await send({ method: "PUT", body: { eventsUrl: "https://agent.example/hook", eventNames: ["ok", 3] } });
  assert.deepEqual([badNames.status, await badNames.json()], [400, { error: "Invalid input: eventNames must be a list of text" }]);
});

test("plain http is allowed only to this machine, and only outside production", () => {
  assert.doesNotThrow(() => checkEventsUrl({ eventsUrl: "http://localhost:4100/hook", allowLocalHttp: true }));
  assert.doesNotThrow(() => checkEventsUrl({ eventsUrl: "http://127.0.0.1:4100/hook", allowLocalHttp: true }));
  assert.throws(() => checkEventsUrl({ eventsUrl: "http://localhost:4100/hook", allowLocalHttp: false }), { message: "Invalid input: eventsUrl must use https" });
  assert.throws(() => checkEventsUrl({ eventsUrl: "http://localhost.evil.example/hook", allowLocalHttp: true }));
});
