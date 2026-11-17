/** Composition of the change-set routes: the only place their concrete functions are wired. */
import { listInputProblems, resolveService } from "@the-market/core";
import type { CapabilityRegistry, ModuleRegistry } from "@the-market/core";
import type { Route } from "../hono-adapter.ts";
import { addChangeToSet } from "./add-change-workflow.ts";
import { applyChangeSet, revertChangeSet } from "./apply-workflow.ts";
import type { AddItem } from "./add-change-workflow.ts";
import { answerChangeSetError, answerSafely, parseJsonBody, readCheckedBody, replyJson } from "./change-set-http.ts";
import { buildChangeSetRoutes, requireChangeSet } from "./change-set-routes.ts";
import type { ChangeSetActions, RouteHelpers } from "./change-set-routes.ts";
import { approveChangeSet, rejectChangeSet } from "./decide-workflow.ts";
import type { MoveChangeSet } from "./decide-workflow.ts";
import { buildDecisionRoutes } from "./decision-routes.ts";
import { applyItem, applyItemsInOrder, describeError, revertItem, revertItemsInReverse } from "./item-steps.ts";

export function composeChangeSetRoutes(input: { registry: ModuleRegistry; capabilities: CapabilityRegistry }): Route[] {
  const changesService = (serviceName: string) => resolveService({ registry: input.registry, moduleName: "changes", serviceName });
  const addItem = changesService("addChangeItem") as AddItem;
  const actions: ChangeSetActions = {
    createChangeSet: changesService("createChangeSet") as ChangeSetActions["createChangeSet"],
    findChangeSet: changesService("findChangeSet") as ChangeSetActions["findChangeSet"],
    addChange: (request) =>
      addChangeToSet({ ...request, capabilities: input.capabilities, listProblems: listInputProblems, addItem }),
  };
  const helpers: RouteHelpers = {
    readBody: (request) => readCheckedBody({ ...request, parse: parseJsonBody, listProblems: listInputProblems }),
    reply: replyJson,
    answer: (run) => answerSafely({ run, answerError: answerChangeSetError, describe: describeError }),
  };
  const moveSet = changesService("moveChangeSet") as MoveChangeSet;
  const capabilities = input.capabilities;
  const steps = (keys: { tenantId: string; changeSetId: string }) => ({
    ...keys,
    findSet: actions.findChangeSet,
    moveSet,
    applyItems: (request: { tenantId: string; items: Parameters<typeof applyItemsInOrder>[0]["items"] }) =>
      applyItemsInOrder({ ...request, applyOne: (step) => applyItem({ ...step, capabilities }), describe: describeError }),
    revertItems: (request: { tenantId: string; items: Parameters<typeof applyItemsInOrder>[0]["items"] }) =>
      revertItemsInReverse({ ...request, revertOne: (step) => revertItem({ ...step, capabilities }), describe: describeError }),
  });
  const decisions = {
    findChangeSet: actions.findChangeSet,
    approve: (request: { tenantId: string; changeSetId: string; approvedBy: string }) => approveChangeSet({ ...request, moveSet }),
    reject: (keys: { tenantId: string; changeSetId: string }) => rejectChangeSet({ ...keys, moveSet }),
    apply: (keys: { tenantId: string; changeSetId: string }) => applyChangeSet(steps(keys)),
    revert: (keys: { tenantId: string; changeSetId: string }) => revertChangeSet(steps(keys)),
  };
  return [
    ...buildChangeSetRoutes({ actions, helpers, requireSet: requireChangeSet }),
    ...buildDecisionRoutes({ actions: decisions, helpers }),
  ];
}
