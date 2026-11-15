import type { SendRequest } from "@the-market/core";
import type { AgentCard, AgentInterface } from "./a2a-types.ts";

/** Registered well-known path for Agent Card discovery (A2A spec section 14.3). */
export const AGENT_CARD_PATH = "/.well-known/agent-card.json";

const REQUIRED_CARD_FIELDS = [
  "name",
  "description",
  "supportedInterfaces",
  "version",
  "capabilities",
  "defaultInputModes",
  "defaultOutputModes",
  "skills",
];

export function buildAgentCardUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${AGENT_CARD_PATH}`;
}

/** Lists the required Agent Card fields an untrusted document lacks. */
export function listMissingFields(candidate: Record<string, unknown>): string[] {
  return REQUIRED_CARD_FIELDS.filter((fieldName) => candidate[fieldName] === undefined);
}

/** Step 1 of the handshake: download and validate an app's Agent Card. */
export async function fetchAgentCard(input: {
  baseUrl: string;
  sendRequest: SendRequest;
  buildCardUrl: (baseUrl: string) => string;
  listMissing: (candidate: Record<string, unknown>) => string[];
}): Promise<AgentCard> {
  const reply = await input.sendRequest({
    url: input.buildCardUrl(input.baseUrl),
    method: "GET",
    headers: { accept: "application/json" },
    bodyText: "",
  });
  if (reply.status !== 200) {
    throw new Error(`Agent Card fetch failed with status ${reply.status}`);
  }
  const candidate = JSON.parse(reply.bodyText) as Record<string, unknown>;
  const missingFields = input.listMissing(candidate);
  if (missingFields.length > 0) {
    throw new Error(`Agent Card is missing: ${missingFields.join(", ")}`);
  }
  return candidate as unknown as AgentCard;
}

/** Step 2: pick the JSON-RPC endpoint the card advertises. */
export function selectJsonRpcUrl(interfaceList: AgentInterface[]): string {
  const rpcInterface = interfaceList.find((entry) => entry.protocolBinding === "JSONRPC");
  if (rpcInterface === undefined) {
    throw new Error("Agent offers no JSONRPC interface");
  }
  return rpcInterface.url;
}
