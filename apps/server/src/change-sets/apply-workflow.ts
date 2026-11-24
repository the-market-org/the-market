/**
 * Workflows that apply and revert a change set through the capability registry.
 * Applying is all or nothing: when an item fails, the items before it are undone.
 */
import type { ChangeItemRecord, ChangeSetRecord } from "@the-market/module-changes";
import type { MoveChangeSet } from "./decide-workflow.ts";
import type { ApplyOutcome } from "./item-steps.ts";

type ItemsStep = (input: { tenantId: string; items: ChangeItemRecord[] }) => Promise<void>;

interface ChangeSetSteps {
  tenantId: string;
  changeSetId: string;
  findSet: (input: { tenantId: string; changeSetId: string }) => Promise<ChangeSetRecord | undefined>;
  moveSet: MoveChangeSet;
  applyItems: (input: { tenantId: string; items: ChangeItemRecord[] }) => Promise<ApplyOutcome>;
  revertItems: ItemsStep;
}

async function findItems(input: ChangeSetSteps): Promise<ChangeItemRecord[]> {
  const changeSet = await input.findSet({ tenantId: input.tenantId, changeSetId: input.changeSetId });
  if (changeSet === undefined) {
    throw new Error("Change set not found");
  }
  return changeSet.items;
}

function moveTo(input: ChangeSetSteps & { fromState: string; toState: string; failureReason: string }): Promise<void> {
  return input.moveSet({
    tenantId: input.tenantId,
    changeSetId: input.changeSetId,
    fromState: input.fromState,
    toState: input.toState,
    approvedBy: "",
    failureReason: input.failureReason,
  });
}

/** Applies an approved change set, all or nothing. */
export async function applyChangeSet(input: ChangeSetSteps): Promise<void> {
  const items = await findItems(input);
  await moveTo({ ...input, fromState: "approved", toState: "applying", failureReason: "" });
  const outcome = await input.applyItems({ tenantId: input.tenantId, items });
  if (outcome.failureMessage !== "") {
    await input.revertItems({ tenantId: input.tenantId, items: items.slice(0, outcome.appliedCount) });
    await moveTo({ ...input, fromState: "applying", toState: "failed", failureReason: outcome.failureMessage });
    throw new Error(outcome.failureMessage);
  }
  await moveTo({ ...input, fromState: "applying", toState: "applied", failureReason: "" });
}

/** Reverts an applied change set, last item first. */
export async function revertChangeSet(input: ChangeSetSteps): Promise<void> {
  const items = await findItems(input);
  await moveTo({ ...input, fromState: "applied", toState: "reverting", failureReason: "" });
  await input.revertItems({ tenantId: input.tenantId, items });
  await moveTo({ ...input, fromState: "reverting", toState: "reverted", failureReason: "" });
}
