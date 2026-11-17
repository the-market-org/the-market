/** Workflows for the merchant's decision on a draft change set. */

export type MoveChangeSet = (input: {
  tenantId: string;
  changeSetId: string;
  fromState: string;
  toState: string;
  approvedBy: string;
  failureReason: string;
}) => Promise<void>;

/** Approves a draft. Every approval records who gave it. */
export async function approveChangeSet(input: {
  tenantId: string;
  changeSetId: string;
  approvedBy: string;
  moveSet: MoveChangeSet;
}): Promise<void> {
  const approvedBy = input.approvedBy.trim();
  if (approvedBy === "") {
    throw new Error("Approval needs a name");
  }
  await input.moveSet({
    tenantId: input.tenantId,
    changeSetId: input.changeSetId,
    fromState: "draft",
    toState: "approved",
    approvedBy,
    failureReason: "",
  });
}

/** Rejects a draft. A rejected change set is never applied. */
export function rejectChangeSet(input: { tenantId: string; changeSetId: string; moveSet: MoveChangeSet }): Promise<void> {
  return input.moveSet({
    tenantId: input.tenantId,
    changeSetId: input.changeSetId,
    fromState: "draft",
    toState: "rejected",
    approvedBy: "",
    failureReason: "",
  });
}
