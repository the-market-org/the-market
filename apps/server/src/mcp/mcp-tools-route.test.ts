import assert from "node:assert/strict";
import { test } from "node:test";
import type { CapabilityDefinition } from "@the-market/core";
import { composeServer } from "../compose.ts";

const titles: Record<string, string> = { p1: "Lead" };
const rename: CapabilityDefinition = {
  name: "catalog.product.rename",
  summary: "Change a product's title",
  inputSchema: { type: "object", required: ["productId", "title"], properties: { productId: { type: "string" }, title: { type: "string" } } },
  risk: "low",
  buildChange: async (request) => {
    const candidate = request.candidate as { productId: string; title: string };
    const oldTitle = titles[candidate.productId];
    return oldTitle === undefined
      ? Promise.reject(new Error("Product not found"))
      : { capabilityName: "catalog.product.rename", tenantId: request.tenantId, summary: `Rename "${oldTitle}" to "${candidate.title}"`, change: candidate, revert: { productId: candidate.productId, title: oldTitle } };
  },
  applyChange: async () => {},
  revertChange: async () => {},
};

function buildRegistry() {
  const changeSets: Array<{ changeSetId: string; tenantId: string; title: string; proposedBy: string; items: unknown[] }> = [];
  return {
    tenancy: { resolveTenant: async () => "tenant-a", findTenant: async () => ({ name: "Shop A" }) },
    catalog: { listProducts: async () => [{ handle: "rope-lead", title: "Lead" }] },
    pages: { findPage: async () => undefined },
    changes: {
      createChangeSet: async (request: { tenantId: string; title: string; proposedBy: string }) => {
        const changeSet = { ...request, changeSetId: `set_${changeSets.length + 1}`, state: "draft", items: [] };
        changeSets.push(changeSet);
        return changeSet;
      },
      findChangeSet: async (request: { changeSetId: string }) => changeSets.find((changeSet) => changeSet.changeSetId === request.changeSetId),
      addChangeItem: async (item: { changeSetId: string }) => {
        changeSets.find((changeSet) => changeSet.changeSetId === item.changeSetId)?.items.push(item);
        return item;
      },
      moveChangeSet: async () => {},
    },
  };
}

const meta = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} };

async function buildAgent() {
  const app = await composeServer({
    readUptime: () => 0,
    registry: buildRegistry(),
    capabilities: { [rename.name]: rename },
    merchantToken: "",
    identity: { verifyToken: async () => ({ subject: "agent-1", tenantId: "tenant-a", role: "agent" }) },
    identityEnabled: true,
  });
  return async (method: string, params: Record<string, unknown> = {}) => {
    const response = await app.request("/mcp", {
      method: "POST",
      headers: { host: "shop-a.example", authorization: "Bearer agent", "mcp-protocol-version": "2026-07-28", "mcp-method": method, "mcp-name": String(params.name ?? "") },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { ...params, _meta: meta } }),
    });
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };
}

test("tools/list shows capabilities with changeSetId and the store tools, sorted", async () => {
  const send = await buildAgent();
  const { body } = await send("tools/list");
  const tools = body.result.tools as Array<{ name: string; description: string; inputSchema: { required: string[] } }>;
  assert.deepEqual(tools.map((tool) => tool.name), ["catalog.product.rename", "store.change-set.create", "store.change-set.read", "store.products.list"]);
  assert.equal(tools[0]?.description, "Change a product's title. Risk: low.");
  assert.deepEqual(tools[0]?.inputSchema.required, ["productId", "title", "changeSetId"]);
});

test("an agent creates a change set, adds a rename and reads it back", async () => {
  const send = await buildAgent();
  const created = await send("tools/call", { name: "store.change-set.create", arguments: { title: "Rename lead" } });
  const changeSetId = created.body.result.structuredContent.changeSetId;
  assert.equal(created.body.result.isError, false);

  const renamed = await send("tools/call", { name: "catalog.product.rename", arguments: { changeSetId, productId: "p1", title: "Rope lead" } });
  assert.equal(renamed.body.result.structuredContent.summary, 'Rename "Lead" to "Rope lead"');

  const read = await send("tools/call", { name: "store.change-set.read", arguments: { changeSetId } });
  assert.deepEqual([read.body.result.structuredContent.proposedBy, read.body.result.structuredContent.items.length], ["agent", 1]);
});

test("a failing capability is a tool result with isError, and an unknown tool a JSON-RPC error", async () => {
  const send = await buildAgent();
  const failed = await send("tools/call", { name: "catalog.product.rename", arguments: { changeSetId: "set_1", productId: "missing", title: "X" } });
  assert.deepEqual([failed.status, failed.body.result.isError, failed.body.result.content[0].text], [200, true, "Product not found"]);

  const unknown = await send("tools/call", { name: "catalog.product.delete", arguments: {} });
  assert.deepEqual([unknown.status, unknown.body.error.code, unknown.body.error.message], [400, -32602, "Unknown tool: catalog.product.delete"]);
});
