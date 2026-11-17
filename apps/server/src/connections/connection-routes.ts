/** Merchant routes for the store's one agent connection: register it, read it, remove it. */
import type { HttpReply } from "@the-market/core";
import type { Route } from "../hono-adapter.ts";
import type { RouteHelpers } from "../change-sets/change-set-routes.ts";

export interface ConnectionActions {
  saveConnection: (input: { tenantId: string; eventsUrl: string; eventNames: string[] }) => Promise<{ signingSecret: string }>;
  findConnection: (input: { tenantId: string }) => Promise<{ eventsUrl: string; eventNames: string[] } | undefined>;
  removeConnection: (input: { tenantId: string }) => Promise<void>;
}

const CONNECTION_SCHEMA = { type: "object", required: ["eventsUrl", "eventNames"], properties: { eventsUrl: { type: "string" }, eventNames: { type: "array" } } };
const LOCAL_HTTP = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

/** Events go over https; plain http only to this machine, and only when allowed (not in production). */
export function checkEventsUrl(input: { eventsUrl: string; allowLocalHttp: boolean }): void {
  const allowed = input.eventsUrl.startsWith("https://") || (input.allowLocalHttp && LOCAL_HTTP.test(input.eventsUrl));
  if (!allowed) {
    throw new Error("Invalid input: eventsUrl must use https");
  }
}

/** Every event name must be text. */
export function readEventNames(value: unknown): string[] {
  const names = value as unknown[];
  if (!names.every((name) => typeof name === "string")) {
    throw new Error("Invalid input: eventNames must be a list of text");
  }
  return names as string[];
}

export function buildConnectionRoutes(input: {
  actions: ConnectionActions;
  helpers: RouteHelpers;
  allowLocalHttp: boolean;
  checkUrl: typeof checkEventsUrl;
  readNames: typeof readEventNames;
}): Route[] {
  const { actions, helpers } = input;
  const path = "/api/agent-connection";
  const route = (method: Route["method"], handle: (tenantId: string, bodyText: string) => Promise<HttpReply>): Route => ({
    method,
    path,
    tenantScoped: true,
    handleRequest: (request) => helpers.answer(() => handle(request.tenantId, request.bodyText)),
  });
  return [
    route("PUT", async (tenantId, bodyText) => {
      const body = helpers.readBody({ bodyText, inputSchema: CONNECTION_SCHEMA });
      input.checkUrl({ eventsUrl: String(body.eventsUrl), allowLocalHttp: input.allowLocalHttp });
      const saved = await actions.saveConnection({ tenantId, eventsUrl: String(body.eventsUrl), eventNames: input.readNames(body.eventNames) });
      return helpers.reply({ status: 200, body: saved });
    }),
    route("GET", async (tenantId) => {
      const connection = await actions.findConnection({ tenantId });
      return connection === undefined ? helpers.reply({ status: 404, body: { error: "Connection not found" } }) : helpers.reply({ status: 200, body: connection });
    }),
    route("DELETE", async (tenantId) => {
      await actions.removeConnection({ tenantId });
      return helpers.reply({ status: 200, body: { removed: true } });
    }),
  ];
}
