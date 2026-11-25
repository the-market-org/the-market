/**
 * Item-level steps for applying and reverting change sets through the capability registry.
 */
import type { CapabilityRegistry } from "@the-market/core";
import type { ChangeItemRecord } from "@the-market/module-changes";
import { describeErrorSafely } from "../error-description.ts";

type ItemStep = (input: { tenantId: string; item: ChangeItemRecord }) => Promise<void>;

/** The outcome of applying items in order: how many succeeded, and the first failure's message. */
export interface ApplyOutcome {
  appliedCount: number;
  failureMessage: string;
}

/** What a caller may see of anything thrown; internal errors become a logged reference. */
export const describeError = describeErrorSafely;

function findCapability(input: { capabilities: CapabilityRegistry; capabilityName: string }) {
  const capability = new Map(Object.entries(input.capabilities)).get(input.capabilityName);
  if (capability === undefined) {
    throw new Error(`Unknown capability: ${input.capabilityName}`);
  }
  return capability;
}

/** Applies one stored item with its capability. */
export async function applyItem(input: {
  tenantId: string;
  item: ChangeItemRecord;
  capabilities: CapabilityRegistry;
}): Promise<void> {
  const capability = findCapability({ capabilities: input.capabilities, capabilityName: input.item.capabilityName });
  await capability.applyChange({ tenantId: input.tenantId, change: input.item.change });
}

/** Reverts one stored item with its capability. */
export async function revertItem(input: {
  tenantId: string;
  item: ChangeItemRecord;
  capabilities: CapabilityRegistry;
}): Promise<void> {
  const capability = findCapability({ capabilities: input.capabilities, capabilityName: input.item.capabilityName });
  await capability.revertChange({ tenantId: input.tenantId, revert: input.item.revert });
}

/** Applies items in order and stops at the first failure. */
export async function applyItemsInOrder(input: {
  tenantId: string;
  items: ChangeItemRecord[];
  applyOne: ItemStep;
  describe: typeof describeError;
}): Promise<ApplyOutcome> {
  for (const [appliedCount, item] of input.items.entries()) {
    try {
      await input.applyOne({ tenantId: input.tenantId, item });
    } catch (error) {
      return { appliedCount, failureMessage: input.describe(error) };
    }
  }
  return { appliedCount: input.items.length, failureMessage: "" };
}

/** Reverts items last first. A failing revert stops and names the item, so it can be finished by hand. */
export async function revertItemsInReverse(input: {
  tenantId: string;
  items: ChangeItemRecord[];
  revertOne: ItemStep;
  describe: typeof describeError;
}): Promise<void> {
  for (const item of [...input.items].reverse()) {
    try {
      await input.revertOne({ tenantId: input.tenantId, item });
    } catch (error) {
      throw new Error(`Revert stopped at item ${item.position}: ${input.describe(error)}`);
    }
  }
}
