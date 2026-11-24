/**
 * Guards merchant routes. A merchant is let in by a signed identity token for the
 * request's own store, or by the shared MERCHANT_TOKEN kept for local development.
 * With neither configured, merchant routes are not mounted at all.
 */
import { timingSafeEqual } from "node:crypto";
import type { HttpReply } from "@the-market/core";
import type { IdentitySocket } from "@the-market/sockets";
import type { Route } from "./hono-adapter.ts";

const MERCHANT_TOKEN_REQUIRED: HttpReply = Object.freeze({
  status: 401,
  headers: { "content-type": "application/json" },
  bodyText: '{"error":"merchant_token_required"}',
});

/** True only for `Bearer <token>` with a configured, non-empty token. Compared in constant time. */
export function matchesMerchantToken(input: { authorization: string; merchantToken: string }): boolean {
  const expected = Buffer.from(`Bearer ${input.merchantToken}`);
  const given = Buffer.from(input.authorization);
  return input.merchantToken !== "" && given.length === expected.length && timingSafeEqual(given, expected);
}

/** The roles that may use merchant routes. */
const MERCHANT_ROLES: readonly string[] = Object.freeze(["merchant", "owner"]);

/** The token after "Bearer ", or "" when the header is not a bearer header. */
export function readBearerToken(authorization: string): string {
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
}

/** True when a verified identity belongs to this store and has a merchant role. */
export function isMerchantOf(input: { identityTenantId: string; identityRole: string; tenantId: string }): boolean {
  return input.identityTenantId === input.tenantId && MERCHANT_ROLES.includes(input.identityRole);
}

/** True for the shared token, or for an identity token of a merchant of the request's store. */
export async function matchesMerchant(input: {
  authorization: string;
  tenantId: string;
  merchantToken: string;
  verifyToken: IdentitySocket["verifyToken"];
  matchesShared: typeof matchesMerchantToken;
  readBearer: typeof readBearerToken;
  isMerchant: typeof isMerchantOf;
}): Promise<boolean> {
  if (input.matchesShared({ authorization: input.authorization, merchantToken: input.merchantToken })) {
    return true;
  }
  const identity = await input.verifyToken({ token: input.readBearer(input.authorization) });
  return (
    identity !== undefined &&
    input.isMerchant({ identityTenantId: identity.tenantId, identityRole: identity.role, tenantId: input.tenantId })
  );
}

/** Wraps each route so it answers 401 unless `matches` lets the request in. Returns no routes when not enabled. */
export function guardMerchantRoutes(input: {
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
      (await input.matches({ authorization: request.authorization, tenantId: request.tenantId }))
        ? route.handleRequest(request)
        : MERCHANT_TOKEN_REQUIRED,
  }));
}
