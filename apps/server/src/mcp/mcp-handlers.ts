/** The MCP endpoint: checks the envelope, dispatches the method, and shapes every reply. */
import type { HttpReply } from "@the-market/core";
import type { McpFailure, McpRequest, readMcpEnvelope } from "./mcp-envelope.ts";

export const SERVER_INFO = Object.freeze({ name: "the-market", version: "0.0.0" });

/** What a method answers: its result's own fields, or a JSON-RPC error. */
export type McpOutcome = { result: Record<string, unknown> } | { failure: { status: number; code: number; message: string } };

/** One MCP method: plain request in, its outcome out. */
export type McpMethod = (input: { request: McpRequest; tenantId: string }) => Promise<McpOutcome>;

export function replyRpcResult(input: { id: string | number; result: Record<string, unknown> }): HttpReply {
  const result = { resultType: "complete", ...input.result, _meta: { "io.modelcontextprotocol/serverInfo": SERVER_INFO } };
  return { status: 200, headers: { "content-type": "application/json" }, bodyText: JSON.stringify({ jsonrpc: "2.0", id: input.id, result }) };
}

export function replyRpcFailure(failure: McpFailure): HttpReply {
  const error = { code: failure.code, message: failure.message, ...(failure.data === undefined ? {} : { data: failure.data }) };
  const envelope = { jsonrpc: "2.0", ...(failure.id === null ? {} : { id: failure.id }), error };
  return { status: failure.status, headers: { "content-type": "application/json" }, bodyText: JSON.stringify(envelope) };
}

/** Turns a method's outcome into its reply. */
export function replyMethodOutcome(input: {
  id: string | number;
  outcome: McpOutcome;
  replyResult: typeof replyRpcResult;
  replyFailure: typeof replyRpcFailure;
}): HttpReply {
  return "failure" in input.outcome
    ? input.replyFailure({ ...input.outcome.failure, id: input.id })
    : input.replyResult({ id: input.id, result: input.outcome.result });
}

export async function handleMcpPost(input: {
  bodyText: string;
  headerValues: Record<string, string>;
  tenantId: string;
  methods: ReadonlyMap<string, McpMethod>;
  readEnvelope: typeof readMcpEnvelope;
  replyResult: typeof replyRpcResult;
  replyFailure: typeof replyRpcFailure;
  replyOutcome: typeof replyMethodOutcome;
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
  const methodOutcome = await method({ request, tenantId: input.tenantId });
  return input.replyOutcome({ id: request.id, outcome: methodOutcome, replyResult: input.replyResult, replyFailure: input.replyFailure });
}

/** `server/discover`: versions, capabilities and guidance for the agent. */
export const discoverServer: McpMethod = async () => ({
  result: {
    supportedVersions: ["2026-07-28"],
    capabilities: { tools: {} },
    instructions: "Build changes into a change set with the store's tools; the merchant reviews and approves every change set.",
  },
});
