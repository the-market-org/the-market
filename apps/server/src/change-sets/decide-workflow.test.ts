import assert from "node:assert/strict";
import { test } from "node:test";
import { approveChangeSet, rejectChangeSet } from "./decide-workflow.ts";
import type { MoveChangeSet } from "./decide-workflow.ts";

function recordMoves(): { moves: unknown[]; moveSet: MoveChangeSet } {
  const moves: unknown[] = [];
  return { moves, moveSet: async (move) => void moves.push(move) };
}

const keys = { tenantId: "tenant-a", changeSetId: "set_1" };

test("approving moves a draft to approved and stores who approved it", async () => {
  const { moves, moveSet } = recordMoves();

  await approveChangeSet({ ...keys, approvedBy: "Ruth", moveSet });

  assert.deepEqual(moves, [{ ...keys, fromState: "draft", toState: "approved", approvedBy: "Ruth", failureReason: "" }]);
});

test("an approval without a name is refused before anything moves", async () => {
  const { moves, moveSet } = recordMoves();

  await assert.rejects(approveChangeSet({ ...keys, approvedBy: "  ", moveSet }), { message: "Approval needs a name" });
  assert.deepEqual(moves, []);
});

test("rejecting moves a draft to rejected", async () => {
  const { moves, moveSet } = recordMoves();

  await rejectChangeSet({ ...keys, moveSet });

  assert.deepEqual(moves, [{ ...keys, fromState: "draft", toState: "rejected", approvedBy: "", failureReason: "" }]);
});
