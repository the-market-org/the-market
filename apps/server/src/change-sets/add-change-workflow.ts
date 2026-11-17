/**
 * Workflow: adds one capability change to a change set. It is the only place
 * that joins the capability registry and the changes module for this step.
 */
import type { CapabilityRegistry, listInputProblems } from "@the-market/core";
import type { ChangeItemRecord } from "@the-market/module-changes";

export type AddItem = (input: {
  tenantId: string;
  changeSetId: string;
  capabilityName: string;
  summary: string;
  change: unknown;
  revert: unknown;
}) => Promise<ChangeItemRecord>;

/** Finds the capability, checks the input, works out the change, then stores it. Stores nothing on failure. */
export async function addChangeToSet(input: {
  tenantId: string;
  changeSetId: string;
  capabilityName: string;
  candidate: unknown;
  capabilities: CapabilityRegistry;
  listProblems: typeof listInputProblems;
  addItem: AddItem;
}): Promise<ChangeItemRecord> {
  const capability = new Map(Object.entries(input.capabilities)).get(input.capabilityName);
  if (capability === undefined) {
    throw new Error(`Unknown capability: ${input.capabilityName}`);
  }
  const problems = input.listProblems({ inputSchema: capability.inputSchema, candidate: input.candidate });
  if (problems.length > 0) {
    throw new Error(`Invalid input: ${problems.join("; ")}`);
  }
  const built = await capability.buildChange({ tenantId: input.tenantId, candidate: input.candidate });
  return input.addItem({
    tenantId: input.tenantId,
    changeSetId: input.changeSetId,
    capabilityName: capability.name,
    summary: built.summary,
    change: built.change,
    revert: built.revert,
  });
}
