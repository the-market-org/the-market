import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTokenIdentity, signSegments } from "../packages/sockets/src/index.ts";
import { createHostedStore, signMerchantToken } from "./create-store.ts";

test("the merchant token is one the store's identity check accepts, for that store, for one hour", async () => {
  const nowSeconds = 1_800_000_000;
  const token = signMerchantToken({ tenantId: "tenant-d", secret: "test-secret", nowSeconds, sign: signSegments });
  const identity = buildTokenIdentity({ secret: "test-secret", readNow: () => nowSeconds * 1000 });
  assert.deepEqual(await identity.verifyToken({ token }), { subject: "merchant-of-tenant-d", tenantId: "tenant-d", role: "merchant" });
  const later = buildTokenIdentity({ secret: "test-secret", readNow: () => (nowSeconds + 3601) * 1000 });
  assert.equal(await later.verifyToken({ token }), undefined, "expired after an hour");
  assert.equal(await buildTokenIdentity({ secret: "other-secret", readNow: () => nowSeconds * 1000 }).verifyToken({ token }), undefined);
});

test("creating a store registers its connection, and a refused step stops with the server's reason", async () => {
  const calls: string[] = [];
  const store = await createHostedStore({
    name: "Shop D",
    host: "shop-d.localhost",
    slug: "shop-d-localhost",
    eventsUrl: "http://localhost:4300/events",
    eventNames: ["changes.change-set.moved"],
    send: async (call) => {
      calls.push(`${call.method} ${call.path} ${JSON.stringify(call.body)}`);
      return call.method === "POST" ? { status: 201, body: { tenantId: "tenant-d" } } : { status: 200, body: { signingSecret: "secret-d" } };
    },
  });
  assert.deepEqual(store, { tenantId: "tenant-d", signingSecret: "secret-d" });
  assert.deepEqual(calls, [
    'POST /api/platform/tenants {"slug":"shop-d-localhost","name":"Shop D","primaryHost":"shop-d.localhost"}',
    'PUT /api/platform/tenants/tenant-d/agent-connection {"eventsUrl":"http://localhost:4300/events","eventNames":["changes.change-set.moved"]}',
  ]);
  const refused = createHostedStore({ name: "Copy", host: "shop-d.localhost", slug: "copy", eventsUrl: "", eventNames: [], send: async () => ({ status: 409, body: { error: "Host is already used" } }) });
  await assert.rejects(refused, { message: "Creating the store failed with 409: Host is already used" });
});
