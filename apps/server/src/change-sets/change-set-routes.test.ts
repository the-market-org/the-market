import assert from "node:assert/strict";
import { test } from "node:test";
import type { CapabilityDefinition } from "@the-market/core";
import type { ChangeSetRecord } from "@the-market/module-changes";
import { composeServer } from "../compose.ts";

const renameLike: CapabilityDefinition = {
  name: "catalog.product.rename",
  summary: "",
  inputSchema: { type: "object", required: ["productId", "title"], properties: { productId: { type: "string" }, title: { type: "string" } } },
  risk: "low",
  buildChange: async (request) => ({
    capabilityName: "catalog.product.rename",
    tenantId: request.tenantId,
    summary: 'Rename "Lead" to "Rope lead"',
    change: request.candidate,
    revert: { productId: "p1", title: "Lead" },
  }),
  applyChange: async () => {},
  revertChange: async () => {},
};

/** Array-backed changes services; tenants come from the host, as in production. */
function buildRegistry() {
  const stored: ChangeSetRecord[] = [];
  const findStored = (query: { tenantId: string; changeSetId: string }) =>
    stored.find((changeSet) => changeSet.tenantId === query.tenantId && changeSet.changeSetId === query.changeSetId);
  return {
    tenancy: { resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" })[request.host], findTenant: async () => undefined },
    catalog: { listProducts: async () => [] },
    pages: { findPage: async () => undefined },
    changes: {
      createChangeSet: async (request: { tenantId: string; title: string; proposedBy: string }) => {
        const record = { ...request, changeSetId: `set_${stored.length + 1}`, state: "draft", approvedBy: "", failureReason: "", items: [] };
        stored.push(record);
        return record;
      },
      findChangeSet: async (query: { tenantId: string; changeSetId: string }) => findStored(query),
      moveChangeSet: async () => {},
      addChangeItem: async (item: { tenantId: string; changeSetId: string; capabilityName: string; summary: string; change: unknown; revert: unknown }) =>
        findStored(item)?.items.push({ ...item, itemId: "item_1", position: 0 }),
    },
  };
}

async function buildClient(merchantToken = "s3cret") {
  const app = await composeServer({ readUptime: () => 0, registry: buildRegistry(), capabilities: { [renameLike.name]: renameLike }, merchantToken, identity: { verifyToken: async () => undefined }, identityEnabled: false });
  return (input: { method?: string; path: string; host?: string; body?: string }) =>
    app.request(input.path, {
      method: input.method ?? "GET",
      headers: { host: input.host ?? "shop-a.example", authorization: "Bearer s3cret" },
      ...(input.body === undefined ? {} : { body: input.body }),
    });
}

test("a merchant creates a change set, adds a rename and reads it back", async () => {
  const send = await buildClient();

  const created = await send({ method: "POST", path: "/api/change-sets", body: '{"title":"Rename leads","proposedBy":"merchant"}' });
  assert.equal(created.status, 201);
  const changeSetId = ((await created.json()) as { changeSetId: string }).changeSetId;

  const added = await send({
    method: "POST",
    path: `/api/change-sets/${changeSetId}/items`,
    body: '{"capabilityName":"catalog.product.rename","input":{"productId":"p1","title":"Rope lead"}}',
  });
  assert.equal(added.status, 201);

  const read = await send({ path: `/api/change-sets/${changeSetId}` });
  const body = (await read.json()) as ChangeSetRecord;
  assert.equal(read.status, 200);
  assert.deepEqual([body.state, body.items.map((item) => item.summary)], ["draft", ['Rename "Lead" to "Rope lead"']]);
});

test("another store's host cannot see the change set", async () => {
  const send = await buildClient();
  await send({ method: "POST", path: "/api/change-sets", body: '{"title":"T","proposedBy":"merchant"}' });

  const response = await send({ path: "/api/change-sets/set_1", host: "shop-b.example" });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Change set not found" });
});

test("without a merchant token the routes do not exist", async () => {
  const send = await buildClient("");
  assert.equal((await send({ method: "POST", path: "/api/change-sets", body: "{}" })).status, 404);
});
