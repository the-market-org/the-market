/**
 * Reads one MCP request (revision 2026-07-28, Streamable HTTP) and refuses it with the
 * specification's status and error code when it is malformed. The first failing check wins.
 */

export const SUPPORTED_VERSIONS: readonly string[] = Object.freeze(["2026-07-28"]);

export interface McpFailure {
  status: number;
  id: string | number | null;
  code: number;
  message: string;
  data?: unknown;
}

export interface McpRequest {
  id: string | number;
  method: string;
  params: Record<string, unknown>;
  protocolVersion: string;
}

/** Plain values every check reads. */
interface EnvelopeView {
  host: string;
  headers: Record<string, string>;
  parsed: boolean;
  body: Record<string, unknown>;
  params: Record<string, unknown>;
  meta: Record<string, unknown>;
}

type EnvelopeCheck = (view: EnvelopeView) => McpFailure | undefined;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readId(body: Record<string, unknown>): string | number | null {
  return typeof body.id === "string" || typeof body.id === "number" ? body.id : null;
}

/** A header value in the specification's `=?base64?…?=` form, decoded; any other value as it is. */
export function decodeHeaderValue(value: string): string {
  const encoded = /^=\?base64\?(.*)\?=$/.exec(value);
  return encoded === null ? value : Buffer.from(String(encoded[1]), "base64").toString("utf8");
}

function fail(input: { view: EnvelopeView; status: number; code: number; message: string; data?: unknown }): McpFailure {
  return { status: input.status, id: readId(input.view.body), code: input.code, message: input.message, data: input.data };
}

const checkOrigin: EnvelopeCheck = (view) => {
  const origin = view.headers.origin;
  const allowed = origin === undefined || [`https://${view.host}`, `http://${view.host}`].includes(origin);
  return allowed ? undefined : fail({ view, status: 403, code: -32600, message: "Origin not allowed" });
};

const checkRequestShape: EnvelopeCheck = (view) => {
  const shaped = view.parsed && view.body.jsonrpc === "2.0" && readId(view.body) !== null && typeof view.body.method === "string";
  return shaped ? undefined : fail({ view, status: 400, code: -32600, message: "Invalid request" });
};

const checkMeta: EnvelopeCheck = (view) => {
  const capabilities = view.meta["io.modelcontextprotocol/clientCapabilities"];
  const present =
    typeof view.meta["io.modelcontextprotocol/protocolVersion"] === "string" && capabilities !== undefined && asRecord(capabilities) === capabilities;
  return present ? undefined : fail({ view, status: 400, code: -32602, message: "Missing required _meta fields" });
};

const checkHeaders: EnvelopeCheck = (view) => {
  const nameMatches = view.body.method !== "tools/call" || decodeHeaderValue(view.headers["mcp-name"] ?? "") === view.params.name;
  const matches =
    view.headers["mcp-protocol-version"] === view.meta["io.modelcontextprotocol/protocolVersion"] &&
    view.headers["mcp-method"] === view.body.method &&
    nameMatches;
  return matches ? undefined : fail({ view, status: 400, code: -32020, message: "Header mismatch: MCP headers do not match the request body" });
};

const checkVersion: EnvelopeCheck = (view) => {
  const requested = String(view.meta["io.modelcontextprotocol/protocolVersion"]);
  return SUPPORTED_VERSIONS.includes(requested)
    ? undefined
    : fail({ view, status: 400, code: -32022, message: "Unsupported protocol version", data: { supported: [...SUPPORTED_VERSIONS], requested } });
};

export const ENVELOPE_CHECKS: readonly EnvelopeCheck[] = Object.freeze([checkOrigin, checkRequestShape, checkMeta, checkHeaders, checkVersion]);

function parseJson(bodyText: string): { parsed: boolean; value: unknown } {
  try {
    return { parsed: true, value: JSON.parse(bodyText) };
  } catch {
    return { parsed: false, value: undefined };
  }
}

export function readMcpEnvelope(input: {
  bodyText: string;
  headerValues: Record<string, string>;
  host: string;
}): { request: McpRequest } | { failure: McpFailure } {
  const json = parseJson(input.bodyText);
  const body = asRecord(json.value);
  const params = asRecord(body.params);
  const view: EnvelopeView = { host: input.host, headers: input.headerValues, parsed: json.parsed, body, params, meta: asRecord(params._meta) };
  const failure = ENVELOPE_CHECKS.reduce<McpFailure | undefined>((found, check) => found ?? check(view), undefined);
  return failure === undefined
    ? { request: { id: readId(body) as string | number, method: String(body.method), params, protocolVersion: String(view.meta["io.modelcontextprotocol/protocolVersion"]) } }
    : { failure };
}
