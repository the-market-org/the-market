import assert from "node:assert/strict";
import { test } from "node:test";
import type { CapabilityDefinition } from "@the-market/core";
import type { McpRequest } from "./mcp-envelope.ts";
import { callTool, findToolRunner, listTools, withChangeSetId } from "./mcp-tools.ts";
import type { ToolSteps } from "./mcp-tools.ts";

const rename = {
  name: "catalog.product.rename",
  summary: "Change a product's title",
  inputSchema: { type: "object", required: ["productId"], properties: { productId: { type: "string" } } },
  risk: "low",
} as unknown as CapabilityDefinition;

function buildSteps(addChange: ToolSteps["addChange"]): ToolSteps {
  return {
    capabilities: { [rename.name]: rename },
    storeTools: new Map([["store.products.list", { description: "List", inputSchema: { type: "object" }, run: async () => ["rope-lead"] }]]),
    addChange,
    describe: (error) => (error as Error).message,
  };
}

function call(name: string, toolArguments: Record<string, unknown>, steps: ToolSteps) {
  const request: McpRequest = { id: 1, method: "tools/call", params: { name, arguments: toolArguments }, protocolVersion: "2026-07-28" };
  return callTool({ request, tenantId: "tenant-a", steps, findRunner: findToolRunner });
}

test("capability tools require the change set they build into", () => {
  assert.deepEqual(withChangeSetId(rename.inputSchema).required, ["productId", "changeSetId"]);
});

test("tools are listed sorted, capabilities with their risk", async () => {
  const outcome = await listTools({ steps: buildSteps(async () => ({})) });
  const tools = "result" in outcome ? (outcome.result.tools as Array<{ name: string; description: string }>) : [];
  assert.deepEqual(tools.map((tool) => [tool.name, tool.description]), [["catalog.product.rename", "Change a product's title. Risk: low."], ["store.products.list", "List"]]);
});

test("a capability call builds into the named change set, without changeSetId in its input", async () => {
  const calls: unknown[] = [];
  const outcome = await call("catalog.product.rename", { changeSetId: "set_1", productId: "p1" }, buildSteps(async (request) => (calls.push(request), { summary: "done" })));
  assert.deepEqual(calls, [{ tenantId: "tenant-a", changeSetId: "set_1", capabilityName: "catalog.product.rename", candidate: { productId: "p1" } }]);
  assert.deepEqual("result" in outcome && [outcome.result.isError, outcome.result.structuredContent], [false, { summary: "done" }]);
});

test("a failing call is a tool error; an unknown tool is a JSON-RPC error", async () => {
  const failing = await call("catalog.product.rename", { changeSetId: "set_1" }, buildSteps(async () => Promise.reject(new Error("Product not found"))));
  assert.deepEqual("result" in failing && [failing.result.isError, failing.result.content], [true, [{ type: "text", text: "Product not found" }]]);
  assert.deepEqual(await call("catalog.product.delete", {}, buildSteps(async () => ({}))), { failure: { status: 400, code: -32602, message: "Unknown tool: catalog.product.delete" } });
});

test("a store tool runs as it is", async () => {
  const outcome = await call("store.products.list", {}, buildSteps(async () => ({})));
  assert.deepEqual("result" in outcome && outcome.result.structuredContent, ["rope-lead"]);
});
