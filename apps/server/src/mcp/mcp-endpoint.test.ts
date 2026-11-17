import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "../compose.ts";

const registry = {
  tenancy: {
    resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a" })[request.host],
    findTenant: async () => ({ name: "Shop A" }),
  },
  catalog: { listProducts: async () => [] },
  pages: { findPage: async () => undefined },
  changes: { createChangeSet: async () => ({}), findChangeSet: async () => undefined, addChangeItem: async () => ({}), moveChangeSet: async () => {} },
};

const identity = {
  verifyToken: async (request: { token: string }) =>
    ({ "agent-a": { subject: "agent-1", tenantId: "tenant-a", role: "agent" } })[request.token],
};

const meta = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} };

async function postMcp(input: { method: string; token?: string }) {
  const app = await composeServer({ readUptime: () => 0, registry, capabilities: {}, merchantToken: "", identity, identityEnabled: true });
  const response = await app.request("/mcp", {
    method: "POST",
    headers: {
      host: "shop-a.example",
      authorization: `Bearer ${input.token ?? "agent-a"}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2026-07-28",
      "mcp-method": input.method,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: input.method, params: { _meta: meta } }),
  });
  return { status: response.status, type: response.headers.get("content-type"), body: (await response.json()) as Record<string, any> };
}

test("server/discover names the supported version, the tools capability and the server", async () => {
  const reply = await postMcp({ method: "server/discover" });
  assert.deepEqual([reply.status, reply.type, reply.body.id], [200, "application/json", 7]);
  assert.equal(reply.body.result.resultType, "complete");
  assert.deepEqual(reply.body.result.supportedVersions, ["2026-07-28"]);
  assert.deepEqual(reply.body.result.capabilities, { tools: {} });
  assert.deepEqual(reply.body.result._meta["io.modelcontextprotocol/serverInfo"], { name: "the-market", version: "0.0.0" });
});

test("an unknown method is 404 with method not found", async () => {
  const reply = await postMcp({ method: "prompts/list" });
  assert.deepEqual([reply.status, reply.body.error.code, reply.body.id], [404, -32601, 7]);
});

test("the endpoint is for this store's agent only", async () => {
  assert.equal((await postMcp({ method: "server/discover", token: "someone-else" })).status, 401);
});
