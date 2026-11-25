/** Composition of the merchant's app routes: install, list, decide. */
import { composeA2aClient } from "@the-market/a2a-gateway";
import { listInputProblems, resolveService } from "@the-market/core";
import type { ModuleRegistry, SendRequest } from "@the-market/core";
import type { AppAuthoriser } from "@the-market/sockets";
import { answerChangeSetError, answerSafely, parseJsonBody, readCheckedBody, replyJson } from "../change-sets/change-set-http.ts";
import { describeError } from "../change-sets/item-steps.ts";
import type { Route } from "../hono-adapter.ts";
import { checkAppAddress, isPrivateAddress } from "./app-address.ts";
import { installApp, readSlotSkills } from "./app-install.ts";

/** What installing needs from outside: fetching (no redirects), DNS, and the app authoriser. */
export interface AppAccess {
  sendRequest: SendRequest;
  lookupAddress: (host: string) => Promise<string[]>;
  authoriser: AppAuthoriser;
}

const NO_APP_ACCESS: AppAccess = {
  sendRequest: async () => Promise.reject(new Error("App installs are not configured")),
  lookupAddress: async () => [],
  authoriser: { decideApp: async () => "pending" },
};
const INSTALL_SCHEMA = { type: "object", required: ["baseUrl", "permissions"], properties: { baseUrl: { type: "string" }, permissions: { type: "array" } } };
const DECISION_SCHEMA = { type: "object", required: ["decision"], properties: { decision: { type: "string" } } };

export function composeAppRoutes(input: { registry: ModuleRegistry; allowLocalHttp: boolean; access: AppAccess | undefined }): Route[] {
  const access = input.access ?? NO_APP_ACCESS;
  const call = (serviceName: string) => (request: unknown) => (resolveService({ registry: input.registry, moduleName: "apps", serviceName }) as (request: unknown) => Promise<any>)(request);
  const client = composeA2aClient(access.sendRequest);
  const readBody = (bodyText: string, inputSchema: Record<string, unknown>) => readCheckedBody({ bodyText, inputSchema, parse: parseJsonBody, listProblems: listInputProblems });
  const answer = (run: () => Promise<{ status: number; body: unknown }>) =>
    answerSafely({ run: async () => replyJson(await run()), answerError: answerChangeSetError, describe: describeError });
  const route = (method: Route["method"], path: string, handle: Route["handleRequest"]): Route => ({ method, path, tenantScoped: true, handleRequest: handle });
  return [
    route("POST", "/api/apps", (request) =>
      answer(async () => {
        const body = readBody(request.bodyText, INSTALL_SCHEMA);
        const app = await installApp({
          tenantId: request.tenantId,
          baseUrl: String(body.baseUrl),
          permissions: (body.permissions as unknown[]).map(String),
          checkAddress: (baseUrl) => checkAppAddress({ baseUrl, allowLocalHttp: input.allowLocalHttp, lookupAddress: access.lookupAddress, isPrivate: isPrivateAddress }),
          discover: client.discoverAgent,
          decide: access.authoriser.decideApp,
          register: call("registerApp"),
          readSkills: readSlotSkills,
        });
        return { status: 201, body: app };
      }),
    ),
    route("GET", "/api/apps", (request) => answer(async () => ({ status: 200, body: { apps: await call("listApps")({ tenantId: request.tenantId }) } }))),
    route("POST", "/api/apps/:appId/decision", (request) =>
      answer(async () => {
        const body = readBody(request.bodyText, DECISION_SCHEMA);
        return { status: 200, body: await call("decideApp")({ tenantId: request.tenantId, appId: String(request.pathParams.appId), decision: String(body.decision) }) };
      }),
    ),
  ];
}
