/**
 * Guards merchant routes with one shared token until the identity socket exists.
 * With no token configured, merchant routes are not mounted at all.
 */
import { timingSafeEqual } from "node:crypto";
import type { HttpReply } from "@the-market/core";
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

/** Wraps each route so it answers 401 without the token. Returns no routes when no token is configured. */
export function guardMerchantRoutes(input: {
  routes: Route[];
  merchantToken: string;
  matches: typeof matchesMerchantToken;
}): Route[] {
  if (input.merchantToken === "") {
    return [];
  }
  return input.routes.map((route) => ({
    ...route,
    handleRequest: (request) =>
      input.matches({ authorization: request.authorization, merchantToken: input.merchantToken })
        ? route.handleRequest(request)
        : Promise.resolve(MERCHANT_TOKEN_REQUIRED),
  }));
}
