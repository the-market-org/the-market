/** Composition of the connection routes: the only place their concrete functions are wired. */
import { listInputProblems, resolveService } from "@the-market/core";
import type { ModuleRegistry } from "@the-market/core";
import { answerChangeSetError, answerSafely, parseJsonBody, readCheckedBody, replyJson } from "../change-sets/change-set-http.ts";
import type { RouteHelpers } from "../change-sets/change-set-routes.ts";
import { describeError } from "../change-sets/item-steps.ts";
import type { Route } from "../hono-adapter.ts";
import { buildConnectionRoutes, checkEventsUrl, readEventNames } from "./connection-routes.ts";
import type { ConnectionActions } from "./connection-routes.ts";

export function composeConnectionRoutes(input: { registry: ModuleRegistry; allowLocalHttp: boolean }): Route[] {
  const service = (serviceName: string) => resolveService({ registry: input.registry, moduleName: "connections", serviceName });
  const actions: ConnectionActions = {
    saveConnection: service("saveConnection") as ConnectionActions["saveConnection"],
    findConnection: service("findConnection") as ConnectionActions["findConnection"],
    removeConnection: service("removeConnection") as ConnectionActions["removeConnection"],
  };
  const helpers: RouteHelpers = {
    readBody: (request) => readCheckedBody({ ...request, parse: parseJsonBody, listProblems: listInputProblems }),
    reply: replyJson,
    answer: (run) => answerSafely({ run, answerError: answerChangeSetError, describe: describeError }),
  };
  return buildConnectionRoutes({ actions, helpers, allowLocalHttp: input.allowLocalHttp, checkUrl: checkEventsUrl, readNames: readEventNames });
}
