import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedMove } from "./change-set-states.ts";
import { explainRefusedMove, moveChangeSet } from "./move-change-set.ts";

/** One stored change set, `set_1` of tenant-a, in the given state. */
function buildStore(state: string) {
  const stored = { tenantId: "tenant-a", changeSetId: "set_1", state };
  const matches = (query: { tenantId: string; changeSetId: string }) =>
    query.tenantId === stored.tenantId && query.changeSetId === stored.changeSetId;
  return {
    stored,
    findSet: async (query: { tenantId: string; changeSetId: string }) =>
      matches(query) ? { ...stored, title: "", proposedBy: "", approvedBy: "", failureReason: "", items: [] } : undefined,
    updateState: async (move: { tenantId: string; changeSetId: string; fromState: string; toState: string }) => {
      const changes = matches(move) && stored.state === move.fromState;
      stored.state = changes ? move.toState : stored.state;
      return changes ? 1 : 0;
    },
  };
}

function move(input: { store: ReturnType<typeof buildStore>; tenantId: string; fromState: string; toState: string }) {
  return moveChangeSet({
    tenantId: input.tenantId,
    changeSetId: "set_1",
    fromState: input.fromState,
    toState: input.toState,
    approvedBy: "",
    failureReason: "",
    isAllowed: isAllowedMove,
    updateState: input.store.updateState,
    findSet: input.store.findSet,
    explainRefusal: explainRefusedMove,
  });
}

test("an allowed move from the stored state changes the state", async () => {
  const store = buildStore("draft");
  await move({ store, tenantId: "tenant-a", fromState: "draft", toState: "approved" });
  assert.equal(store.stored.state, "approved");
});

test("a move outside the state table is refused and changes nothing", async () => {
  const store = buildStore("draft");
  await assert.rejects(move({ store, tenantId: "tenant-a", fromState: "draft", toState: "applied" }), {
    message: "Change set cannot move from draft to applied",
  });
  assert.equal(store.stored.state, "draft");
});

test("a move from a stale state is refused", async () => {
  const store = buildStore("approved");
  await assert.rejects(move({ store, tenantId: "tenant-a", fromState: "draft", toState: "rejected" }), {
    message: "Change set cannot move from draft to rejected",
  });
  assert.equal(store.stored.state, "approved");
});

test("another tenant's change set is not found", async () => {
  const store = buildStore("draft");
  await assert.rejects(move({ store, tenantId: "tenant-b", fromState: "draft", toState: "approved" }), {
    message: "Change set not found",
  });
  assert.equal(store.stored.state, "draft");
});
