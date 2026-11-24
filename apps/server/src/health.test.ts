import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "./compose.ts";

const fakeRegistry = { tenancy: { resolveTenant: async () => undefined }, catalog: { listProducts: async () => [] } };

test("GET /health reports the loaded modules", async () => {
  const app = await composeServer({ readUptime: () => 12.4, registry: fakeRegistry, capabilities: {}, merchantToken: "", identity: { verifyToken: async () => undefined }, identityEnabled: false });

  const response = await app.request("/health");

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.deepEqual(await response.json(), { status: "ok", modules: ["tenancy", "catalog"], uptimeSeconds: 12 });
});

test("unknown routes answer 404", async () => {
  const app = await composeServer({ readUptime: () => 0, registry: fakeRegistry, capabilities: {}, merchantToken: "", identity: { verifyToken: async () => undefined }, identityEnabled: false });
  assert.equal((await app.request("/nope")).status, 404);
});
