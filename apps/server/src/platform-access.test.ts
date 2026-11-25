import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "./compose.ts";
import { matchesPlatformToken } from "./platform-access.ts";

const registry = {
  tenancy: { resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a" })[request.host], findTenant: async () => ({ name: "Shop" }) },
  catalog: { listProducts: async () => [] },
  pages: { findPage: async () => undefined },
  changes: { createChangeSet: async () => ({}), findChangeSet: async () => undefined, addChangeItem: async () => ({}), moveChangeSet: async () => {} },
  connections: { saveConnection: async () => ({ signingSecret: "" }), findConnection: async () => undefined, removeConnection: async () => {} },
};

async function buildServer(platformToken: string | undefined) {
  const identities: Record<string, { subject: string; tenantId: string; role: string }> = {
    "agent-token": { subject: "agent-1", tenantId: "tenant-a", role: "agent" },
    "owner-token": { subject: "owner-1", tenantId: "tenant-a", role: "owner" },
  };
  const app = await composeServer({
    readUptime: () => 0,
    registry,
    capabilities: {},
    merchantToken: "merchant-secret",
    identity: { verifyToken: async (request) => identities[request.token] },
    identityEnabled: true,
    platformToken,
  });
  return async (input: { path: string; token: string; host?: string }) =>
    (await app.request(input.path, { headers: { host: input.host ?? "publisher.internal", authorization: `Bearer ${input.token}` } })).status;
}

test("without PLATFORM_TOKEN the platform routes do not exist", async () => {
  const send = await buildServer(undefined);
  assert.equal(await send({ path: "/api/platform/status", token: "anything" }), 404);
  assert.equal(await (await buildServer(""))({ path: "/api/platform/status", token: "" }), 404);
});

test("only the platform token opens platform routes, and it opens no store's routes", async () => {
  const send = await buildServer("platform-secret");
  assert.equal(await send({ path: "/api/platform/status", token: "platform-secret" }), 200, "not tied to a store's host");
  for (const token of ["wrong", "merchant-secret", "agent-token", "owner-token", ""]) {
    assert.equal(await send({ path: "/api/platform/status", token }), 401, `token ${token || "(none)"}`);
  }
  assert.equal(await send({ path: "/api/change-sets/set_1", token: "platform-secret", host: "shop-a.example" }), 401);
  assert.equal(await send({ path: "/api/change-sets/set_1", token: "merchant-secret", host: "shop-a.example" }), 404, "the merchant token still works there");
});

test("a token is compared whole, and an empty configured token matches nothing", () => {
  assert.equal(matchesPlatformToken({ authorization: "Bearer platform-secret", platformToken: "platform-secret" }), true);
  assert.equal(matchesPlatformToken({ authorization: "Bearer platform-secre", platformToken: "platform-secret" }), false);
  assert.equal(matchesPlatformToken({ authorization: "Bearer ", platformToken: "" }), false);
});
