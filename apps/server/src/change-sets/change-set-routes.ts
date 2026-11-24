/** The merchant's change-set routes. Every route is tenant scoped and guarded by the merchant token. */
import type { HttpReply } from "@the-market/core";
import type { ChangeItemRecord, ChangeSetRecord } from "@the-market/module-changes";
import type { Route, RouteRequest } from "../hono-adapter.ts";

export interface ChangeSetActions {
  createChangeSet: (input: { tenantId: string; title: string; proposedBy: string }) => Promise<ChangeSetRecord>;
  findChangeSet: (input: { tenantId: string; changeSetId: string }) => Promise<ChangeSetRecord | undefined>;
  addChange: (input: { tenantId: string; changeSetId: string; capabilityName: string; candidate: unknown }) => Promise<ChangeItemRecord>;
}

/** The helpers every route uses, passed in so the routes stay plain. */
export interface RouteHelpers {
  readBody: (input: { bodyText: string; inputSchema: Record<string, unknown> }) => Record<string, unknown>;
  reply: (input: { status: number; body: unknown }) => HttpReply;
  answer: (run: () => Promise<HttpReply>) => Promise<HttpReply>;
}

const CREATE_SCHEMA = { type: "object", required: ["title", "proposedBy"], properties: { title: { type: "string" }, proposedBy: { type: "string" } } };
const ITEM_SCHEMA = { type: "object", required: ["capabilityName", "input"], properties: { capabilityName: { type: "string" } } };

/** Finds a change set or throws `Change set not found`. */
export async function requireChangeSet(input: {
  tenantId: string;
  changeSetId: string;
  findSet: ChangeSetActions["findChangeSet"];
}): Promise<ChangeSetRecord> {
  const changeSet = await input.findSet({ tenantId: input.tenantId, changeSetId: input.changeSetId });
  if (changeSet === undefined) {
    throw new Error("Change set not found");
  }
  return changeSet;
}

function readKeys(request: RouteRequest): { tenantId: string; changeSetId: string } {
  return { tenantId: request.tenantId, changeSetId: String(request.pathParams.changeSetId) };
}

/** Create, read, and add an item. */
export function buildChangeSetRoutes(input: { actions: ChangeSetActions; helpers: RouteHelpers; requireSet: typeof requireChangeSet }): Route[] {
  const { actions, helpers } = input;
  const route = (method: Route["method"], path: string, handle: (request: RouteRequest) => Promise<HttpReply>): Route => ({
    method,
    path,
    tenantScoped: true,
    handleRequest: (request) => helpers.answer(() => handle(request)),
  });
  return [
    route("POST", "/api/change-sets", async (request) => {
      const body = helpers.readBody({ bodyText: request.bodyText, inputSchema: CREATE_SCHEMA });
      const changeSet = await actions.createChangeSet({ tenantId: request.tenantId, title: String(body.title), proposedBy: String(body.proposedBy) });
      return helpers.reply({ status: 201, body: changeSet });
    }),
    route("GET", "/api/change-sets/:changeSetId", async (request) =>
      helpers.reply({ status: 200, body: await input.requireSet({ ...readKeys(request), findSet: actions.findChangeSet }) }),
    ),
    route("POST", "/api/change-sets/:changeSetId/items", async (request) => {
      const body = helpers.readBody({ bodyText: request.bodyText, inputSchema: ITEM_SCHEMA });
      const item = await actions.addChange({ ...readKeys(request), capabilityName: String(body.capabilityName), candidate: body.input });
      return helpers.reply({ status: 201, body: item });
    }),
  ];
}
