/**
 * A small MCP client for revision 2026-07-28: one stateless POST per request, the protocol
 * version carried in every request's `_meta` and mirrored in the headers.
 */

export type PostJson = (input: { url: string; headers: Record<string, string>; bodyText: string }) => Promise<{ status: number; bodyText: string }>;

const PROTOCOL_VERSION = "2026-07-28";
const CLIENT_INFO = Object.freeze({ name: "the-market example agent", version: "0.0.0" });

/** The text of a tool result's first content block, used as the error message. */
export function readToolText(result: Record<string, unknown>): string {
  const content = Array.isArray(result.content) ? (result.content as Array<{ text?: unknown }>) : [];
  return content.map((block) => String(block.text)).join(" ") || "The tool failed";
}

export function buildMcpClient(input: { endpointUrl: string; agentToken: string; post: PostJson }) {
  let requestCount = 0;
  const callMethod = async (request: { method: string; params: Record<string, unknown> }): Promise<Record<string, unknown>> => {
    requestCount += 1;
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${input.agentToken}`,
      "mcp-protocol-version": PROTOCOL_VERSION,
      "mcp-method": request.method,
      ...(request.method === "tools/call" ? { "mcp-name": String(request.params.name) } : {}),
    };
    const requestMeta = {
      "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": CLIENT_INFO,
    };
    const body = { jsonrpc: "2.0", id: requestCount, method: request.method, params: { ...request.params, _meta: requestMeta } };
    const reply = JSON.parse((await input.post({ url: input.endpointUrl, headers, bodyText: JSON.stringify(body) })).bodyText);
    if (reply.error !== undefined) {
      throw new Error(`MCP ${request.method} failed (${reply.error.code}): ${reply.error.message}`);
    }
    return reply.result as Record<string, unknown>;
  };
  return {
    callMethod,
    /** Calls one tool and returns its structured content; a tool error throws its text. */
    callTool: async (request: { name: string; toolArguments: Record<string, unknown> }): Promise<unknown> => {
      const result = await callMethod({ method: "tools/call", params: { name: request.name, arguments: request.toolArguments } });
      if (result.isError === true) {
        throw new Error(readToolText(result));
      }
      return result.structuredContent;
    },
  };
}
