import type { ChangesDatabase } from "./changes-types.ts";

/** The message for a move that changed no row: the set is missing, or not in the stated state. */
export function explainRefusedMove(input: { setExists: boolean; fromState: string; toState: string }): string {
  return input.setExists
    ? `Change set cannot move from ${input.fromState} to ${input.toState}`
    : "Change set not found";
}

/** Moves a change set from one state to another, checked against the table and the stored state. */
export async function moveChangeSet(input: {
  tenantId: string;
  changeSetId: string;
  fromState: string;
  toState: string;
  approvedBy: string;
  failureReason: string;
  isAllowed: (move: { fromState: string; toState: string }) => boolean;
  updateState: ChangesDatabase["updateState"];
  findSet: ChangesDatabase["findChangeSet"];
  explainRefusal: typeof explainRefusedMove;
}): Promise<void> {
  const keys = { tenantId: input.tenantId, changeSetId: input.changeSetId };
  const setExists = (await input.findSet(keys)) !== undefined;
  if (!input.isAllowed({ fromState: input.fromState, toState: input.toState })) {
    throw new Error(input.explainRefusal({ setExists, fromState: input.fromState, toState: input.toState }));
  }
  const changedRows = await input.updateState({
    ...keys,
    fromState: input.fromState,
    toState: input.toState,
    approvedBy: input.approvedBy,
    failureReason: input.failureReason,
  });
  if (changedRows === 0) {
    throw new Error(input.explainRefusal({ setExists, fromState: input.fromState, toState: input.toState }));
  }
}
