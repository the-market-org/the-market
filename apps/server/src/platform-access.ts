/**
 * Guards the platform routes a publisher uses to create and manage stores. They are not scoped to a
 * store's host, and only the separate PLATFORM_TOKEN opens them: store tokens never do, and the
 * platform token never opens a store's routes. With no PLATFORM_TOKEN, the routes are not mounted.
 */
import { timingSafeEqual } from "node:crypto";
import type { HttpReply } from "@the-market/core";
import type { Route } from "./hono-adapter.ts";

const PLATFORM_TOKEN_REQUIRED: HttpReply = Object.freeze({
  status: 401,
  headers: { "content-type": "application/json" },
  bodyText: '{"error":"unauthorized"}',
});

/** True only for `Bearer <token>` with a configured, non-empty platform token. Compared in constant time. */
export function matchesPlatformToken(input: { authorization: string; platformToken: string }): boolean {
  const expected = Buffer.from(`Bearer ${input.platformToken}`);
  const given = Buffer.from(input.authorization);
  return input.platformToken !== "" && given.length === expected.length && timingSafeEqual(given, expected);
}

/** Wraps each platform route so it answers 401 without the platform token. Returns no routes when no token is set. */
export function guardPlatformRoutes(input: {
  routes: Route[];
  platformToken: string;
  matches: typeof matchesPlatformToken;
}): Route[] {
  const enabled = input.platformToken !== "";
  return (enabled ? input.routes : []).map((route) => ({
    ...route,
    tenantScoped: false,
    handleRequest: async (request) =>
      input.matches({ authorization: request.authorization, platformToken: input.platformToken }) ? route.handleRequest(request) : PLATFORM_TOKEN_REQUIRED,
  }));
}

/** The platform's own routes. Store creation is added in the next task. */
export function composePlatformRoutes(): Route[] {
  return [
    {
      method: "GET",
      path: "/api/platform/status",
      tenantScoped: false,
      handleRequest: async () => ({ status: 200, headers: { "content-type": "application/json" }, bodyText: '{"platform":"ready"}' }),
    },
  ];
}
