/**
 * Guards the platform routes a publisher uses to create and manage stores. They are not scoped to a
 * store's host, and only the separate PLATFORM_TOKEN opens them: store tokens never do, and the
 * platform token never opens a store's routes. With no PLATFORM_TOKEN, the routes are not mounted.
 */
import { timingSafeEqual } from "node:crypto";
import { listInputProblems, resolveService } from "@the-market/core";
import type { HttpReply, ModuleRegistry } from "@the-market/core";
import { answerChangeSetError, answerSafely, parseJsonBody, readCheckedBody, replyJson } from "./change-sets/change-set-http.ts";
import { describeError } from "./change-sets/item-steps.ts";
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

const STORE_SCHEMA = { type: "object", required: ["slug", "name", "primaryHost"], properties: { slug: { type: "string" }, name: { type: "string" }, primaryHost: { type: "string" } } };

/** The store, or `Tenant not found`. */
export function requireTenant<Tenant>(tenant: Tenant | undefined): Tenant {
  if (tenant === undefined) {
    throw new Error("Tenant not found");
  }
  return tenant;
}

/** The platform's own routes: a status check, and creating and reading stores. */
export function composePlatformRoutes(input: { registry: ModuleRegistry }): Route[] {
  const call = (serviceName: string) => async (request: unknown) => (resolveService({ registry: input.registry, moduleName: "tenancy", serviceName }) as (request: unknown) => Promise<any>)(request);
  const answer = (run: () => Promise<{ status: number; body: unknown }>) => answerSafely({ run: async () => replyJson(await run()), answerError: answerChangeSetError, describe: describeError });
  const route = (method: Route["method"], path: string, handle: Route["handleRequest"]): Route => ({ method, path, tenantScoped: false, handleRequest: handle });
  return [
    route("GET", "/api/platform/status", async () => replyJson({ status: 200, body: { platform: "ready" } })),
    route("POST", "/api/platform/tenants", (request) =>
      answer(async () => {
        const body = readCheckedBody({ bodyText: request.bodyText, inputSchema: STORE_SCHEMA, parse: parseJsonBody, listProblems: listInputProblems });
        return { status: 201, body: await call("createStore")({ slug: String(body.slug), name: String(body.name), primaryHost: String(body.primaryHost) }) };
      }),
    ),
    route("GET", "/api/platform/tenants/:tenantId", (request) =>
      answer(async () => ({ status: 200, body: requireTenant(await call("findTenant")({ tenantId: String(request.pathParams.tenantId) })) })),
    ),
  ];
}
