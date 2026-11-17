/** The merchant's decision routes: approve, reject, apply, revert. Each answers the change set as it now is. */
import type { HttpReply } from "@the-market/core";
import type { ChangeSetRecord } from "@the-market/module-changes";
import type { Route, RouteRequest } from "../hono-adapter.ts";
import type { RouteHelpers } from "./change-set-routes.ts";

type Keys = { tenantId: string; changeSetId: string };

export interface DecisionActions {
  findChangeSet: (input: Keys) => Promise<ChangeSetRecord | undefined>;
  approve: (input: Keys & { approvedBy: string }) => Promise<void>;
  reject: (input: Keys) => Promise<void>;
  apply: (input: Keys) => Promise<void>;
  revert: (input: Keys) => Promise<void>;
}

const APPROVE_SCHEMA = { type: "object", required: ["approvedBy"], properties: { approvedBy: { type: "string" } } };

export function buildDecisionRoutes(input: { actions: DecisionActions; helpers: RouteHelpers }): Route[] {
  const { actions, helpers } = input;
  const decision = (verb: string, act: (request: RouteRequest, keys: Keys) => Promise<void>): Route => ({
    method: "POST",
    path: `/api/change-sets/:changeSetId/${verb}`,
    tenantScoped: true,
    handleRequest: (request) =>
      helpers.answer(async (): Promise<HttpReply> => {
        const keys = { tenantId: request.tenantId, changeSetId: String(request.pathParams.changeSetId) };
        await act(request, keys);
        return helpers.reply({ status: 200, body: await actions.findChangeSet(keys) });
      }),
  });
  return [
    decision("approve", (request, keys) => {
      const body = helpers.readBody({ bodyText: request.bodyText, inputSchema: APPROVE_SCHEMA });
      return actions.approve({ ...keys, approvedBy: String(body.approvedBy) });
    }),
    decision("reject", (_request, keys) => actions.reject(keys)),
    decision("apply", (_request, keys) => actions.apply(keys)),
    decision("revert", (_request, keys) => actions.revert(keys)),
  ];
}
