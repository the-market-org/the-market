/** The MCP endpoint: checks the envelope, dispatches the method, and shapes every reply. */
import type { HttpReply } from "@the-market/core";
import type { McpFailure, McpRequest, readMcpEnvelope } from "./mcp-envelope.ts";

export const SERVER_INFO = Object.freeze({ name: "the-market", version: "0.0.0" });

/** One MCP method: plain request in, the result's own fields out. */
export type McpMethod = (input: { request: McpRequest; tenantId: string }) => Promise<Record<string, unknown>>;

export function replyRpcResult(input: { id: string | number; result: Record<string, unknown> }): HttpReply {
  const result = { resultType: "complete", ...input.result, _meta: { "io.modelcontextprotocol/serverInfo": SERVER_INFO } };
  return { status: 200, headers: { "content-type": "application/json" }, bodyText: JSON.stringify({ jsonrpc: "2.0", id: input.id, result }) };
}

export function replyRpcFailure(failure: McpFailure): HttpReply {
  const error = { code: failure.code, message: failure.message, ...(failure.data === undefined ? {} : { data: failure.data }) };
  const envelope = { jsonrpc: "2.0", ...(failure.id === null ? {} : { id: failure.id }), error };
  return { status: failure.status, headers: { "content-type": "application/json" }, bodyText: JSON.stringify(envelope) };
}

export async function handleMcpPost(input: {
  bodyText: string;
  headerValues: Record<string, string>;
  tenantId: string;
  methods: ReadonlyMap<string, McpMethod>;
  readEnvelope: typeof readMcpEnvelope;
  replyResult: typeof replyRpcResult;
  replyFailure: typeof replyRpcFailure;
}): Promise<HttpReply> {
  const outcome = input.readEnvelope({ bodyText: input.bodyText, headerValues: input.headerValues, host: input.headerValues.host ?? "" });
  if ("failure" in outcome) {
    return input.replyFailure(outcome.failure);
  }
  const { request } = outcome;
  const method = input.methods.get(request.method);
  if (method === undefined) {
    return input.replyFailure({ status: 404, id: request.id, code: -32601, message: `Method not found: ${request.method}` });
  }
  return input.replyResult({ id: request.id, result: await method({ request, tenantId: input.tenantId }) });
}

/** `server/discover`: versions, capabilities and guidance for the agent. */
export const discoverServer: McpMethod = async () => ({
  supportedVersions: ["2026-07-28"],
  capabilities: { tools: {} },
  instructions: "Build changes into a change set with the store's tools; the merchant reviews and approves every change set.",
});
