import assert from "node:assert/strict";
import { test } from "node:test";
import { ALLOWED_MOVES, isAllowedMove } from "./change-set-states.ts";

test("every move in the table is allowed", () => {
  for (const [fromState, toStates] of Object.entries(ALLOWED_MOVES)) {
    for (const toState of toStates) {
      assert.equal(isAllowedMove({ fromState, toState }), true, `${fromState} -> ${toState}`);
    }
  }
});

test("moves outside the table are refused", () => {
  assert.equal(isAllowedMove({ fromState: "draft", toState: "applied" }), false);
  assert.equal(isAllowedMove({ fromState: "rejected", toState: "approved" }), false);
  assert.equal(isAllowedMove({ fromState: "reverted", toState: "reverting" }), false);
  assert.equal(isAllowedMove({ fromState: "unknown", toState: "draft" }), false);
});
