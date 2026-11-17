/** Composition of the change-set routes: the only place their concrete functions are wired. */
import { listInputProblems, resolveService } from "@the-market/core";
import type { CapabilityRegistry, ModuleRegistry } from "@the-market/core";
import type { Route } from "../hono-adapter.ts";
import { addChangeToSet } from "./add-change-workflow.ts";
import type { AddItem } from "./add-change-workflow.ts";
import { answerChangeSetError, answerSafely, parseJsonBody, readCheckedBody, replyJson } from "./change-set-http.ts";
import { buildChangeSetRoutes, requireChangeSet } from "./change-set-routes.ts";
import type { ChangeSetActions, RouteHelpers } from "./change-set-routes.ts";
import { describeError } from "./item-steps.ts";

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
  return buildChangeSetRoutes({ actions, helpers, requireSet: requireChangeSet });
}
