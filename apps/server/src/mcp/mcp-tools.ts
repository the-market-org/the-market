/** `tools/list` and `tools/call`: the store's capabilities as tools that build into a change set, plus store tools. */
import type { CapabilityRegistry } from "@the-market/core";
import type { McpRequest } from "./mcp-envelope.ts";
import type { McpOutcome } from "./mcp-handlers.ts";

export interface StoreTool {
  description: string;
  inputSchema: Record<string, unknown>;
  run: (input: { toolArguments: Record<string, unknown>; tenantId: string }) => Promise<unknown>;
}

export interface ToolSteps {
  capabilities: CapabilityRegistry;
  storeTools: ReadonlyMap<string, StoreTool>;
  addChange: (input: { tenantId: string; changeSetId: string; capabilityName: string; candidate: unknown }) => Promise<unknown>;
  describe: (error: unknown) => string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** A capability's input schema with the change set it builds into added as a required field. */
export function withChangeSetId(schema: Record<string, unknown>): Record<string, unknown> {
  const required = (schema.required ?? []) as string[];
  const properties = asRecord(schema.properties);
  return { ...schema, type: "object", required: [...required, "changeSetId"], properties: { ...properties, changeSetId: { type: "string" } } };
}

export async function listTools(input: { steps: ToolSteps }): Promise<McpOutcome> {
  const capabilityTools = Object.values(input.steps.capabilities).map((capability) => ({
    name: capability.name,
    description: `${capability.summary}. Risk: ${capability.risk}.`,
    inputSchema: withChangeSetId(capability.inputSchema),
  }));
  const storeTools = [...input.steps.storeTools].map(([name, tool]) => ({ name, description: tool.description, inputSchema: tool.inputSchema }));
  return { result: { tools: [...capabilityTools, ...storeTools].sort((first, second) => first.name.localeCompare(second.name)) } };
}

/** The work a tool call does, or undefined for an unknown tool. */
export function findToolRunner(input: {
  name: string;
  toolArguments: Record<string, unknown>;
  tenantId: string;
  steps: ToolSteps;
}): (() => Promise<unknown>) | undefined {
  const storeTool = input.steps.storeTools.get(input.name);
  if (storeTool !== undefined) {
    return () => storeTool.run({ toolArguments: input.toolArguments, tenantId: input.tenantId });
  }
  const { changeSetId, ...candidate } = input.toolArguments;
  return new Map(Object.entries(input.steps.capabilities)).has(input.name)
    ? () => input.steps.addChange({ tenantId: input.tenantId, changeSetId: String(changeSetId), capabilityName: input.name, candidate })
    : undefined;
}

export async function callTool(input: {
  request: McpRequest;
  tenantId: string;
  steps: ToolSteps;
  findRunner: typeof findToolRunner;
}): Promise<McpOutcome> {
  const name = String(input.request.params.name);
  const runner = input.findRunner({ name, toolArguments: asRecord(input.request.params.arguments), tenantId: input.tenantId, steps: input.steps });
  if (runner === undefined) {
    return { failure: { status: 400, code: -32602, message: `Unknown tool: ${name}` } };
  }
  try {
    const value = await runner();
    return { result: { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value, isError: false } };
  } catch (error) {
    return { result: { content: [{ type: "text", text: input.steps.describe(error) }], isError: true } };
  }
}
