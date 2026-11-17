import assert from "node:assert/strict";
import { test } from "node:test";
import { readMcpEnvelope } from "./mcp-envelope.ts";

const meta = { "io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {} };
const goodBody = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "catalog.product.rename", arguments: {}, _meta: meta } };
const goodHeaders = { "mcp-protocol-version": "2026-07-28", "mcp-method": "tools/call", "mcp-name": "catalog.product.rename" };

function read(input: { body?: unknown; headers?: Record<string, string>; bodyText?: string }) {
  return readMcpEnvelope({ bodyText: input.bodyText ?? JSON.stringify(input.body ?? goodBody), headerValues: input.headers ?? goodHeaders, host: "shop-a.example" });
}

function failureOf(input: Parameters<typeof read>[0]) {
  const outcome = read(input);
  return "failure" in outcome ? [outcome.failure.status, outcome.failure.code] : "accepted";
}

test("a well-formed modern request is accepted with its id, method, params and version", () => {
  const outcome = read({});
  assert.deepEqual("request" in outcome && [outcome.request.id, outcome.request.method, outcome.request.protocolVersion], [1, "tools/call", "2026-07-28"]);
});

test("an Origin other than the store's own host is forbidden", () => {
  assert.deepEqual(failureOf({ headers: { ...goodHeaders, origin: "https://evil.example" } }), [403, -32600]);
  assert.equal(failureOf({ headers: { ...goodHeaders, origin: "https://shop-a.example" } }), "accepted");
});

test("a body that is not a JSON-RPC request is invalid", () => {
  assert.deepEqual(failureOf({ bodyText: "{not json" }), [400, -32600]);
  assert.deepEqual(failureOf({ body: { ...goodBody, jsonrpc: "1.0" } }), [400, -32600]);
  assert.deepEqual(failureOf({ body: { ...goodBody, id: null } }), [400, -32600]);
});

test("missing _meta fields are invalid params", () => {
  assert.deepEqual(failureOf({ body: { ...goodBody, params: { name: "x", arguments: {} } } }), [400, -32602]);
});

test("headers that disagree with the body are a header mismatch", () => {
  assert.deepEqual(failureOf({ headers: { ...goodHeaders, "mcp-protocol-version": "2025-11-25" } }), [400, -32020]);
  assert.deepEqual(failureOf({ headers: { ...goodHeaders, "mcp-method": "tools/list" } }), [400, -32020]);
  assert.deepEqual(failureOf({ headers: { ...goodHeaders, "mcp-name": "other" } }), [400, -32020]);
  const { "mcp-name": _ignored, ...withoutName } = goodHeaders;
  assert.deepEqual(failureOf({ headers: withoutName }), [400, -32020]);
  const encodedName = `=?base64?${Buffer.from("catalog.product.rename").toString("base64")}?=`;
  assert.equal(failureOf({ headers: { ...goodHeaders, "mcp-name": encodedName } }), "accepted");
});

test("an unsupported version lists the supported ones", () => {
  const body = { ...goodBody, params: { ...goodBody.params, _meta: { ...meta, "io.modelcontextprotocol/protocolVersion": "1900-01-01" } } };
  const outcome = read({ body, headers: { ...goodHeaders, "mcp-protocol-version": "1900-01-01" } });
  assert.deepEqual("failure" in outcome && [outcome.failure.status, outcome.failure.code, outcome.failure.data], [400, -32022, { supported: ["2026-07-28"], requested: "1900-01-01" }]);
});
