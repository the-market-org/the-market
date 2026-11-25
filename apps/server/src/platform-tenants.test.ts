import assert from "node:assert/strict";
import { test } from "node:test";
import { createStore, normaliseHost } from "@the-market/module-tenancy";
import { composeServer } from "./compose.ts";

type Store = { tenantId: string; slug: string; name: string; primaryHost: string; status: string };

function buildRegistry() {
  const stores: Store[] = [{ tenantId: "tenant-a", slug: "demo", name: "Demo", primaryHost: "shop-a.example", status: "active" }];
  const database = {
    findTenantByHost: async (query: { host: string }) => stores.find((store) => store.primaryHost === query.host),
    findTenantById: async (query: { tenantId: string }) => stores.find((store) => store.tenantId === query.tenantId),
    findTenantBySlug: async (query: { slug: string }) => stores.find((store) => store.slug === query.slug),
    insertTenant: async (store: Omit<Store, "tenantId" | "status">) => {
      const record = { ...store, tenantId: `tenant-${stores.length + 1}`, status: "active" };
      stores.push(record);
      return record;
    },
  };
  return {
    tenancy: {
      resolveTenant: async (request: { host: string }) => (await database.findTenantByHost({ host: request.host }))?.tenantId,
      findTenant: database.findTenantById,
      createStore: (store: { slug: string; name: string; primaryHost: string }) => createStore({ ...store, database, normalise: normaliseHost }),
    },
    catalog: { listProducts: async () => [] },
    pages: { findPage: async () => undefined },
  };
}

async function buildPlatform() {
  const app = await composeServer({ readUptime: () => 0, registry: buildRegistry(), capabilities: {}, merchantToken: "", identity: { verifyToken: async () => undefined }, identityEnabled: false, platformToken: "platform-secret" });
  return async (input: { method?: string; path: string; body?: unknown; host?: string }) => {
    const headers = { host: input.host ?? "publisher.internal", authorization: "Bearer platform-secret", "content-type": "application/json" };
    const response = await app.request(input.path, { method: input.method ?? "GET", headers, ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }) });
    return { status: response.status, body: await response.text() };
  };
}

test("a publisher creates a store, reads it back, and its host serves the storefront at once", async () => {
  const send = await buildPlatform();
  const created = await send({ method: "POST", path: "/api/platform/tenants", body: { slug: "shop-d", name: "Shop D", primaryHost: "Shop-D.Example" } });
  assert.equal(created.status, 201);
  const store = JSON.parse(created.body) as Store;
  assert.deepEqual([store.slug, store.primaryHost, store.status], ["shop-d", "shop-d.example", "active"]);
  assert.equal(JSON.parse((await send({ path: `/api/platform/tenants/${store.tenantId}` })).body).name, "Shop D");
  assert.equal((await send({ path: "/", host: "shop-d.example" })).status, 200);
});

test("a taken host or slug, a bad slug and an unknown store are refused without showing another store", async () => {
  const send = await buildPlatform();
  const taken = await send({ method: "POST", path: "/api/platform/tenants", body: { slug: "new-shop", name: "New", primaryHost: "shop-a.example" } });
  assert.deepEqual(taken, { status: 409, body: '{"error":"Host is already used"}' });
  assert.equal((await send({ method: "POST", path: "/api/platform/tenants", body: { slug: "demo", name: "New", primaryHost: "new.example" } })).status, 409);
  assert.equal((await send({ method: "POST", path: "/api/platform/tenants", body: { slug: "No Spaces", name: "New", primaryHost: "new.example" } })).status, 400);
  assert.equal((await send({ method: "POST", path: "/api/platform/tenants", body: { name: "New" } })).status, 400);
  assert.deepEqual(await send({ path: "/api/platform/tenants/tenant-99" }), { status: 404, body: '{"error":"Tenant not found"}' });
});
