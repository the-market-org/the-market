/**
 * Platform routes for a store's agent connection: the publisher registers or removes it for a store
 * named in the path. They reuse the store's own connection handlers, with the same address checks.
 */
import { listInputProblems, resolveService } from "@the-market/core";
import type { ModuleRegistry } from "@the-market/core";
import { answerChangeSetError, answerSafely, parseJsonBody, readCheckedBody, replyJson } from "./change-sets/change-set-http.ts";
import { describeError } from "./change-sets/item-steps.ts";
import { buildConnectionRoutes, checkEventsUrl, readEventNames } from "./connections/connection-routes.ts";
import type { ConnectionActions } from "./connections/connection-routes.ts";
import type { Route } from "./hono-adapter.ts";

const TENANT_NOT_FOUND = replyJson({ status: 404, body: { error: "Tenant not found" } });

/** Runs a store's own route for the store in the path, or answers 404 when there is no such store. */
export function routeForStore(input: { route: Route; findTenant: (request: { tenantId: string }) => Promise<unknown> }): Route {
  return {
    method: input.route.method,
    path: "/api/platform/tenants/:tenantId/agent-connection",
    tenantScoped: false,
    handleRequest: async (request) => {
      const tenantId = String(request.pathParams.tenantId);
      const tenant = await input.findTenant({ tenantId });
      return tenant === undefined ? TENANT_NOT_FOUND : input.route.handleRequest({ ...request, tenantId });
    },
  };
}

export function composePlatformConnectionRoutes(input: { registry: ModuleRegistry; allowLocalHttp: boolean }): Route[] {
  const call = (moduleName: string, serviceName: string) => async (request: unknown) => (resolveService({ registry: input.registry, moduleName, serviceName }) as (request: unknown) => Promise<never>)(request);
  const actions: ConnectionActions = {
    saveConnection: call("connections", "saveConnection"),
    findConnection: call("connections", "findConnection"),
    removeConnection: call("connections", "removeConnection"),
  };
  const helpers = {
    readBody: (request: { bodyText: string; inputSchema: Record<string, unknown> }) => readCheckedBody({ ...request, parse: parseJsonBody, listProblems: listInputProblems }),
    reply: replyJson,
    answer: (run: () => Promise<ReturnType<typeof replyJson>>) => answerSafely({ run, answerError: answerChangeSetError, describe: describeError }),
  };
  const storeRoutes = buildConnectionRoutes({ actions, helpers, allowLocalHttp: input.allowLocalHttp, checkUrl: checkEventsUrl, readNames: readEventNames });
  return storeRoutes.filter((route) => route.method !== "GET").map((route) => routeForStore({ route, findTenant: call("tenancy", "findTenant") }));
}
