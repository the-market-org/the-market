/** Composition of the A2A routes: the only place their concrete functions are wired. */
import { AGENT_CARD_PATH, composeA2aServer } from "@the-market/a2a-gateway";
import { resolveService } from "@the-market/core";
import type { ModuleRegistry } from "@the-market/core";
import type { ChangeSetRecord } from "@the-market/module-changes";
import type { Route } from "../hono-adapter.ts";
import { buildApprovalHandlers, describeTaskState } from "./a2a-handlers.ts";
import { buildStoreAgentCard } from "./store-agent-card.ts";

const JSON_HEADERS = { "content-type": "application/json" };

/** The public agent card of the request's store. */
export function composeAgentCardRoute(input: { registry: ModuleRegistry }): Route {
  const findTenant = resolveService({ registry: input.registry, moduleName: "tenancy", serviceName: "findTenant" }) as (request: { tenantId: string }) => Promise<{ name: string } | undefined>;
  return {
    method: "GET",
    path: AGENT_CARD_PATH,
    tenantScoped: true,
    handleRequest: async (request) => {
      const tenant = await findTenant({ tenantId: request.tenantId });
      const card = buildStoreAgentCard({ storeName: tenant?.name ?? "", host: request.headerValues.host ?? "" });
      return { status: 200, headers: JSON_HEADERS, bodyText: JSON.stringify(card) };
    },
  };
}

/** `POST /a2a`: approval tasks for the store's agent. Guarded by the caller. */
export function composeA2aRoutes(input: { registry: ModuleRegistry }): Route[] {
  const findSet = resolveService({ registry: input.registry, moduleName: "changes", serviceName: "findChangeSet" }) as (keys: { tenantId: string; changeSetId: string }) => Promise<ChangeSetRecord | undefined>;
  return [
    {
      method: "POST",
      path: "/a2a",
      tenantScoped: true,
      handleRequest: async (request) => {
        const answer = composeA2aServer(buildApprovalHandlers({ tenantId: request.tenantId, findSet, describeState: describeTaskState }));
        return { status: 200, headers: JSON_HEADERS, bodyText: await answer(request.bodyText) };
      },
    },
  ];
}
