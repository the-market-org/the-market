import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMcpClient } from "./mcp-client.ts";
import type { PostJson } from "./mcp-client.ts";

function buildClient(replies: unknown[]) {
  const sent: Array<{ url: string; headers: Record<string, string>; body: any }> = [];
  const post: PostJson = async (request) => {
    sent.push({ url: request.url, headers: request.headers, body: JSON.parse(request.bodyText) });
    return { status: 200, bodyText: JSON.stringify(replies.shift()) };
  };
  return { sent, client: buildMcpClient({ endpointUrl: "http://localhost:3000/mcp", agentToken: "agent-token", post }) };
}

test("every request carries the protocol version in _meta and the mirrored headers", async () => {
  const { sent, client } = buildClient([{ jsonrpc: "2.0", id: 1, result: { resultType: "complete", structuredContent: { changeSetId: "set_1" }, isError: false } }]);

  assert.deepEqual(await client.callTool({ name: "store.change-set.create", toolArguments: { title: "Starter" } }), { changeSetId: "set_1" });

  const [request] = sent;
  assert.equal(request?.url, "http://localhost:3000/mcp");
  assert.deepEqual(request?.headers, {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    authorization: "Bearer agent-token",
    "mcp-protocol-version": "2026-07-28",
    "mcp-method": "tools/call",
    "mcp-name": "store.change-set.create",
  });
  assert.deepEqual(request?.body, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "store.change-set.create",
      arguments: { title: "Starter" },
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": { name: "the-market example agent", version: "0.0.0" },
      },
    },
  });
});

test("ids count up, and methods other than tools/call send no Mcp-Name", async () => {
  const { sent, client } = buildClient([
    { jsonrpc: "2.0", id: 1, result: { resultType: "complete", tools: [] } },
    { jsonrpc: "2.0", id: 2, result: { resultType: "complete", supportedVersions: ["2026-07-28"] } },
  ]);
  assert.deepEqual(await client.callMethod({ method: "tools/list", params: {} }), { resultType: "complete", tools: [] });
  await client.callMethod({ method: "server/discover", params: {} });
  assert.deepEqual(sent.map((request) => [request.body.id, "mcp-name" in request.headers]), [[1, false], [2, false]]);
});

test("a tool error throws its text, and a JSON-RPC error throws its code", async () => {
  const { client } = buildClient([
    { jsonrpc: "2.0", id: 1, result: { resultType: "complete", content: [{ type: "text", text: "Product not found" }], isError: true } },
    { jsonrpc: "2.0", id: 2, error: { code: -32602, message: "Unknown tool: x" } },
  ]);
  await assert.rejects(client.callTool({ name: "catalog.product.rename", toolArguments: {} }), { message: "Product not found" });
  await assert.rejects(client.callTool({ name: "x", toolArguments: {} }), { message: "MCP tools/call failed (-32602): Unknown tool: x" });
});
