/** Composition of the MCP endpoint: the only place its concrete functions are wired. */
import { listInputProblems, resolveService } from "@the-market/core";
import type { CapabilityRegistry, ModuleRegistry } from "@the-market/core";
import type { ChangeSetRecord } from "@the-market/module-changes";
import { composeA2aRoutes } from "../a2a/compose-a2a.ts";
import { guardAgentRoutes } from "../agent-access.ts";
import { addChangeToSet } from "../change-sets/add-change-workflow.ts";
import type { AddItem } from "../change-sets/add-change-workflow.ts";
import { requireChangeSet } from "../change-sets/change-set-routes.ts";
import { describeError } from "../change-sets/item-steps.ts";
import type { Route } from "../hono-adapter.ts";
import { readMcpEnvelope } from "./mcp-envelope.ts";
import { discoverServer, handleMcpPost, replyMethodOutcome, replyRpcFailure, replyRpcResult } from "./mcp-handlers.ts";
import type { McpMethod } from "./mcp-handlers.ts";
import { callTool, findToolRunner, listTools } from "./mcp-tools.ts";
import type { StoreTool, ToolSteps } from "./mcp-tools.ts";

type Keys = { tenantId: string; changeSetId: string };

function buildStoreTools(input: { registry: ModuleRegistry }): ReadonlyMap<string, StoreTool> {
  const service = (moduleName: string, serviceName: string) => resolveService({ registry: input.registry, moduleName, serviceName });
  const createChangeSet = service("changes", "createChangeSet") as (request: { tenantId: string; title: string; proposedBy: string }) => Promise<ChangeSetRecord>;
  const findSet = service("changes", "findChangeSet") as (request: Keys) => Promise<ChangeSetRecord | undefined>;
  const listProducts = service("catalog", "listProducts") as (request: { tenantId: string }) => Promise<unknown[]>;
  return new Map<string, StoreTool>([
    [
      "store.change-set.create",
      {
        description: "Create a draft change set to build changes into. Returns its changeSetId.",
        inputSchema: { type: "object", required: ["title"], properties: { title: { type: "string" } } },
        run: async ({ toolArguments, tenantId }) => ({
          changeSetId: (await createChangeSet({ tenantId, title: String(toolArguments.title ?? "Untitled"), proposedBy: "agent" })).changeSetId,
        }),
      },
    ],
    [
      "store.change-set.read",
      {
        description: "Read a change set and its items.",
        inputSchema: { type: "object", required: ["changeSetId"], properties: { changeSetId: { type: "string" } } },
        run: ({ toolArguments, tenantId }) => requireChangeSet({ tenantId, changeSetId: String(toolArguments.changeSetId), findSet }),
      },
    ],
    [
      "store.products.list",
      { description: "List the store's products.", inputSchema: { type: "object", additionalProperties: false }, run: ({ tenantId }) => listProducts({ tenantId }) },
    ],
  ]);
}

export function composeMcpRoutes(input: { registry: ModuleRegistry; capabilities: CapabilityRegistry }): Route[] {
  const addItem = resolveService({ registry: input.registry, moduleName: "changes", serviceName: "addChangeItem" }) as AddItem;
  const steps: ToolSteps = {
    capabilities: input.capabilities,
    storeTools: buildStoreTools(input),
    addChange: (request) => addChangeToSet({ ...request, capabilities: input.capabilities, listProblems: listInputProblems, addItem }),
    describe: describeError,
  };
  const methods = new Map<string, McpMethod>([
    ["server/discover", discoverServer],
    ["tools/list", () => listTools({ steps })],
    ["tools/call", (request) => callTool({ ...request, steps, findRunner: findToolRunner })],
  ]);
  return [
    {
      method: "POST",
      path: "/mcp",
      tenantScoped: true,
      handleRequest: (request) =>
        handleMcpPost({
          bodyText: request.bodyText,
          headerValues: request.headerValues,
          tenantId: request.tenantId,
          methods,
          readEnvelope: readMcpEnvelope,
          replyResult: replyRpcResult,
          replyFailure: replyRpcFailure,
          replyOutcome: replyMethodOutcome,
        }),
    },
  ];
}

/** The agent routes, guarded; none when identity is not configured. */
export function composeAgentRoutes(input: {
  enabled: boolean;
  registry: ModuleRegistry;
  capabilities: CapabilityRegistry;
  matches: (request: { authorization: string; tenantId: string }) => Promise<boolean>;
}): Route[] {
  const routes = input.enabled
    ? [...composeMcpRoutes({ registry: input.registry, capabilities: input.capabilities }), ...composeA2aRoutes({ registry: input.registry })]
    : [];
  return guardAgentRoutes({ routes, enabled: input.enabled, matches: input.matches });
}
