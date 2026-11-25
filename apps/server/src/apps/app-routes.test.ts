import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "../compose.ts";

function buildRegistry() {
  const apps: Array<Record<string, any>> = [];
  return {
    tenancy: { resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" })[request.host], findTenant: async () => ({ name: "Shop" }) },
    catalog: { listProducts: async () => [] },
    pages: { findPage: async () => undefined },
    changes: { createChangeSet: async () => ({}), findChangeSet: async () => undefined, addChangeItem: async () => ({}), moveChangeSet: async () => {} },
    connections: { saveConnection: async () => ({ signingSecret: "" }), findConnection: async () => undefined, removeConnection: async () => {} },
    apps: {
      registerApp: async (app: Record<string, any>) => {
        const { decision, ...rest } = app;
        const record = { ...rest, appId: `app_${apps.length + 1}`, status: decision === "allowed" ? "active" : "pending" };
        apps.push(record);
        return record;
      },
      listApps: async (request: { tenantId: string }) => apps.filter((app) => app.tenantId === request.tenantId),
      decideApp: async (request: { tenantId: string; appId: string; decision: string }) => {
        const app = apps.find((stored) => stored.tenantId === request.tenantId && stored.appId === request.appId);
        return app === undefined ? Promise.reject(new Error("App not found")) : Object.assign(app, { status: request.decision === "allowed" ? "active" : "refused" });
      },
    },
  };
}

const reviewCard = {
  name: "Review stars",
  description: "",
  version: "0.0.0",
  supportedInterfaces: [{ url: "https://reviews.example/a2a", protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
  capabilities: {},
  defaultInputModes: [],
  defaultOutputModes: [],
  skills: [{ id: "review-stars", name: "Stars", description: "", tags: ["storefront-slot"] }],
};

const appAccess = {
  sendRequest: async () => ({ status: 200, headers: {}, bodyText: JSON.stringify(reviewCard) }),
  lookupAddress: async (host: string) => (host === "reviews.example" ? ["93.184.216.34"] : ["10.0.0.7"]),
  authoriser: { decideApp: async () => "pending" as const },
};

async function buildClient() {
  const app = await composeServer({ readUptime: () => 0, registry: buildRegistry(), capabilities: {}, merchantToken: "s3cret", identity: { verifyToken: async () => undefined }, identityEnabled: false, appAccess });
  return async (input: { method: string; path: string; body?: unknown; host?: string }) => {
    const response = await app.request(input.path, { method: input.method, headers: { host: input.host ?? "shop-a.example", authorization: "Bearer s3cret", "content-type": "application/json" }, ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }) });
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };
}

test("a merchant installs an app, sees it pending, and the owner allows it", async () => {
  const send = await buildClient();
  const installed = await send({ method: "POST", path: "/api/apps", body: { baseUrl: "https://reviews.example", permissions: ["read:products"] } });
  assert.deepEqual([installed.status, installed.body.status, installed.body.slotSkills, installed.body.rpcUrl], [201, "pending", ["review-stars"], "https://reviews.example/a2a"]);

  const decided = await send({ method: "POST", path: `/api/apps/${installed.body.appId}/decision`, body: { decision: "allowed" } });
  assert.deepEqual([decided.status, decided.body.status], [200, "active"]);
  assert.deepEqual((await send({ method: "GET", path: "/api/apps" })).body.apps.map((stored: { name: string }) => stored.name), ["Review stars"]);
  assert.deepEqual((await send({ method: "GET", path: "/api/apps", host: "shop-b.example" })).body.apps, []);
});

test("an address inside the network is refused, and another store's app is not found", async () => {
  const send = await buildClient();
  const inside = await send({ method: "POST", path: "/api/apps", body: { baseUrl: "https://intranet.example", permissions: [] } });
  assert.deepEqual([inside.status, inside.body.error], [400, "Invalid input: baseUrl must be a public https address"]);
  const missing = await send({ method: "POST", path: "/api/apps/app_9/decision", body: { decision: "allowed" } });
  assert.deepEqual([missing.status, missing.body.error], [404, "App not found"]);
});
