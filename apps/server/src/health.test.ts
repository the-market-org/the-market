import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "./compose.ts";

test("GET /health reports the loaded modules", async () => {
  const app = await composeServer({ readUptime: () => 12.4, databaseUrl: "postgresql://usr:pwd@localhost:5432/unused" });

  const response = await app.request("/health");

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.deepEqual(await response.json(), { status: "ok", modules: ["catalog"], uptimeSeconds: 12 });
});

test("unknown routes answer 404", async () => {
  const app = await composeServer({ readUptime: () => 0, databaseUrl: "postgresql://usr:pwd@localhost:5432/unused" });
  assert.equal((await app.request("/nope")).status, 404);
});
