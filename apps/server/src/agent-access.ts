/**
 * Guards agent routes (MCP, A2A). An agent is let in only by a signed identity token
 * whose role is `agent` and whose tenant is the request's store. The shared merchant
 * token never opens agent routes.
 */
import type { HttpReply } from "@the-market/core";
import type { IdentitySocket } from "@the-market/sockets";
import type { Route } from "./hono-adapter.ts";

const AGENT_TOKEN_REQUIRED: HttpReply = Object.freeze({
  status: 401,
  headers: { "content-type": "application/json" },
  bodyText: '{"error":"agent_token_required"}',
});

/** True when a verified identity is this store's agent. */
export function hasAgentRole(input: { identityTenantId: string; identityRole: string; tenantId: string }): boolean {
  return input.identityTenantId === input.tenantId && input.identityRole === "agent";
}

export async function matchesAgent(input: {
  authorization: string;
  tenantId: string;
  verifyToken: IdentitySocket["verifyToken"];
  readBearer: (authorization: string) => string;
  hasRole: typeof hasAgentRole;
}): Promise<boolean> {
  const identity = await input.verifyToken({ token: input.readBearer(input.authorization) });
  return identity !== undefined && input.hasRole({ identityTenantId: identity.tenantId, identityRole: identity.role, tenantId: input.tenantId });
}

/** Wraps each route so it answers 401 unless `matches` lets the request in. Returns no routes when not enabled. */
export function guardAgentRoutes(input: {
  routes: Route[];
  enabled: boolean;
  matches: (request: { authorization: string; tenantId: string }) => Promise<boolean>;
}): Route[] {
  if (!input.enabled) {
    return [];
  }
  return input.routes.map((route) => ({
    ...route,
    handleRequest: async (request) =>
      (await input.matches({ authorization: request.authorization, tenantId: request.tenantId })) ? route.handleRequest(request) : AGENT_TOKEN_REQUIRED,
  }));
}
