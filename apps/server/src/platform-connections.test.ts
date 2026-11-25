import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "./compose.ts";

function buildRegistry() {
  const connections = new Map<string, { eventsUrl: string; eventNames: string[]; signingSecret: string }>();
  return {
    tenancy: {
      resolveTenant: async (request: { host: string }) => ({ "shop-d.example": "tenant-d", "shop-a.example": "tenant-a" })[request.host],
      findTenant: async (request: { tenantId: string }) => (["tenant-a", "tenant-d"].includes(request.tenantId) ? { tenantId: request.tenantId, name: "Shop" } : undefined),
    },
    catalog: { listProducts: async () => [] },
    pages: { findPage: async () => undefined },
    changes: { createChangeSet: async () => ({}), findChangeSet: async () => undefined, addChangeItem: async () => ({}), moveChangeSet: async () => {} },
    connections: {
      saveConnection: async (request: { tenantId: string; eventsUrl: string; eventNames: string[] }) => {
        const saved = { eventsUrl: request.eventsUrl, eventNames: request.eventNames, signingSecret: `secret-for-${request.tenantId}` };
        connections.set(request.tenantId, saved);
        return saved;
      },
      findConnection: async (request: { tenantId: string }) => {
        const saved = connections.get(request.tenantId);
        return saved === undefined ? undefined : { eventsUrl: saved.eventsUrl, eventNames: saved.eventNames };
      },
      removeConnection: async (request: { tenantId: string }) => void connections.delete(request.tenantId),
    },
  };
}

async function buildServer() {
  const app = await composeServer({ readUptime: () => 0, registry: buildRegistry(), capabilities: {}, merchantToken: "merchant-secret", identity: { verifyToken: async () => undefined }, identityEnabled: false, platformToken: "platform-secret" });
  return async (input: { method?: string; path: string; body?: unknown; host?: string; token?: string }) => {
    const headers = { host: input.host ?? "publisher.internal", authorization: `Bearer ${input.token ?? "platform-secret"}`, "content-type": "application/json" };
    const response = await app.request(input.path, { method: input.method ?? "GET", headers, ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }) });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
}

const connection = { eventsUrl: "https://agent.example/events", eventNames: ["changes.change-set.moved"] };

test("a publisher registers a store's agent connection, and only that store sees it", async () => {
  const send = await buildServer();
  const saved = await send({ method: "PUT", path: "/api/platform/tenants/tenant-d/agent-connection", body: connection });
  assert.deepEqual([saved.status, saved.body.signingSecret], [200, "secret-for-tenant-d"]);
  const seen = await send({ path: "/api/agent-connection", host: "shop-d.example", token: "merchant-secret" });
  assert.deepEqual(seen, { status: 200, body: connection }, "the merchant sees it, without the signing secret");
  assert.equal((await send({ path: "/api/agent-connection", host: "shop-a.example", token: "merchant-secret" })).status, 404);
  assert.equal((await send({ method: "DELETE", path: "/api/platform/tenants/tenant-d/agent-connection" })).status, 200);
  assert.equal((await send({ path: "/api/agent-connection", host: "shop-d.example", token: "merchant-secret" })).status, 404);
});

test("an unknown store, a plain http address and a missing token are refused", async () => {
  const send = await buildServer();
  assert.deepEqual(await send({ method: "PUT", path: "/api/platform/tenants/tenant-x/agent-connection", body: connection }), { status: 404, body: { error: "Tenant not found" } });
  assert.equal((await send({ method: "PUT", path: "/api/platform/tenants/tenant-d/agent-connection", body: { ...connection, eventsUrl: "http://agent.example/events" } })).status, 400);
  assert.equal((await send({ method: "PUT", path: "/api/platform/tenants/tenant-d/agent-connection", body: connection, token: "merchant-secret" })).status, 401);
});
