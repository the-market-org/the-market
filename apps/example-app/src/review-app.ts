/** An example third-party app: an A2A agent with one storefront-slot skill that answers with a star rating. */
import type { AgentCard, RpcHandlerMap } from "@the-market/a2a-gateway";

export const REVIEW_FRAGMENT = '<p class="stars">★★★★☆ 4.6 from 128 reviews</p>';

export function buildReviewCard(input: { baseUrl: string }): AgentCard {
  return {
    name: "Review stars",
    description: "Shows a product's review rating in a storefront slot.",
    version: "0.0.0",
    supportedInterfaces: [{ url: `${input.baseUrl}/a2a`, protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["text/html"],
    skills: [{ id: "review-stars", name: "Review stars", description: "An HTML fragment with the product's rating.", tags: ["storefront-slot"] }],
  };
}

export function buildReviewHandlers(): RpcHandlerMap {
  return {
    SendMessage: async () => ({ message: { messageId: `stars-${Date.now()}`, role: "ROLE_AGENT", parts: [{ text: REVIEW_FRAGMENT, mediaType: "text/html" }] } }),
  };
}

/** One HTTP request to the app: the Agent Card, the A2A endpoint, or 404. */
export async function answerAppRequest(input: {
  method: string;
  path: string;
  bodyText: string;
  card: AgentCard;
  answerRpc: (bodyText: string) => Promise<string>;
}): Promise<{ status: number; headers: Record<string, string>; bodyText: string }> {
  const json = { "content-type": "application/json" };
  const routes: Record<string, () => Promise<string>> = {
    "GET /.well-known/agent-card.json": async () => JSON.stringify(input.card),
    "POST /a2a": () => input.answerRpc(input.bodyText),
  };
  const route = routes[`${input.method} ${input.path}`];
  return route === undefined ? { status: 404, headers: json, bodyText: '{"error":"not_found"}' } : { status: 200, headers: json, bodyText: await route() };
}
