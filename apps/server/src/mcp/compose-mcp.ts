/** Composition of the MCP endpoint: the only place its concrete functions are wired. */
import type { Route } from "../hono-adapter.ts";
import { readMcpEnvelope } from "./mcp-envelope.ts";
import { discoverServer, handleMcpPost, replyMethodOutcome, replyRpcFailure, replyRpcResult } from "./mcp-handlers.ts";
import type { McpMethod } from "./mcp-handlers.ts";

export function composeMcpRoutes(input: { extraMethods: ReadonlyArray<readonly [string, McpMethod]> }): Route[] {
  const methods = new Map<string, McpMethod>([["server/discover", discoverServer], ...input.extraMethods]);
  return [
    {
      method: "POST",
      path: "/mcp",
      tenantScoped: true,
      handleRequest: (request) =>
        handleMcpPost({
          bodyText: request.bodyText,
          headerValues: request.headerValues,
          tenantId: request.tenantId,
          methods,
          readEnvelope: readMcpEnvelope,
          replyResult: replyRpcResult,
          replyFailure: replyRpcFailure,
          replyOutcome: replyMethodOutcome,
        }),
    },
  ];
}
