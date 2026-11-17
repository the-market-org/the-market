import assert from "node:assert/strict";
import { test } from "node:test";
import type { CapabilityDefinition } from "@the-market/core";
import type { ChangeSetRecord } from "@the-market/module-changes";
import { applyChangeSet, revertChangeSet } from "./apply-workflow.ts";
import { applyItem, applyItemsInOrder, describeError, revertItem, revertItemsInReverse } from "./item-steps.ts";
import type { MoveChangeSet } from "./decide-workflow.ts";

/** A capability that records every call; an item whose change has `fail` rejects with that text. */
function buildRecorder(calls: string[]): CapabilityDefinition {
  return {
    name: "catalog.product.rename",
    summary: "",
    inputSchema: {},
    risk: "low",
    buildChange: async () => ({ capabilityName: "", tenantId: "", summary: "", change: null, revert: null }),
    applyChange: async (request) => {
      const change = request.change as { position: number; fail?: string };
      calls.push(`apply ${change.position}`);
      return change.fail === undefined ? undefined : Promise.reject(new Error(change.fail));
    },
    revertChange: async (request) => void calls.push(`revert ${(request.revert as { position: number }).position}`),
  };
}

function buildChangeSet(input: { state: string; failAt?: number; capabilityName?: string }): ChangeSetRecord {
  const items = [0, 1, 2].map((position) => ({
    itemId: `item_${position}`,
    position,
    capabilityName: input.capabilityName ?? "catalog.product.rename",
    summary: "",
    change: position === input.failAt ? { position, fail: "Product not found" } : { position },
    revert: { position },
  }));
  return { changeSetId: "set_1", tenantId: "tenant-a", title: "", state: input.state, proposedBy: "", approvedBy: "", failureReason: "", items };
}

function buildRun(changeSet: ChangeSetRecord, moveSet?: MoveChangeSet) {
  const calls: string[] = [];
  const moves: string[] = [];
  const capabilities = { "catalog.product.rename": buildRecorder(calls) };
  const steps = {
    tenantId: "tenant-a",
    changeSetId: "set_1",
    findSet: async () => changeSet,
    moveSet:
      moveSet ??
      (async (move: Parameters<MoveChangeSet>[0]) => void moves.push(`${move.fromState}->${move.toState} ${move.failureReason}`.trim())),
    applyItems: (request: { tenantId: string; items: ChangeSetRecord["items"] }) =>
      applyItemsInOrder({ ...request, applyOne: (step) => applyItem({ ...step, capabilities }), describe: describeError }),
    revertItems: (request: { tenantId: string; items: ChangeSetRecord["items"] }) =>
      revertItemsInReverse({ ...request, revertOne: (step) => revertItem({ ...step, capabilities }), describe: describeError }),
  };
  return { calls, moves, steps };
}

test("applying runs every item in order and ends applied", async () => {
  const { calls, moves, steps } = buildRun(buildChangeSet({ state: "approved" }));

  await applyChangeSet(steps);

  assert.deepEqual(calls, ["apply 0", "apply 1", "apply 2"]);
  assert.deepEqual(moves, ["approved->applying", "applying->applied"]);
});

test("when an item fails, earlier items are reverted, later ones never run, and the set ends failed", async () => {
  const { calls, moves, steps } = buildRun(buildChangeSet({ state: "approved", failAt: 1 }));

  await assert.rejects(applyChangeSet(steps), { message: "Product not found" });

  assert.deepEqual(calls, ["apply 0", "apply 1", "revert 0"]);
  assert.deepEqual(moves, ["approved->applying", "applying->failed Product not found"]);
});

test("a set that cannot move to applying applies nothing", async () => {
  const refuse: MoveChangeSet = async () => {
    throw new Error("Change set cannot move from approved to applying");
  };
  const { calls, steps } = buildRun(buildChangeSet({ state: "applying" }), refuse);

  await assert.rejects(applyChangeSet(steps), { message: "Change set cannot move from approved to applying" });
  assert.deepEqual(calls, []);
});

test("an item whose capability is gone fails like any other item", async () => {
  const { calls, moves, steps } = buildRun(buildChangeSet({ state: "approved", capabilityName: "catalog.product.gone" }));

  await assert.rejects(applyChangeSet(steps), { message: "Unknown capability: catalog.product.gone" });
  assert.deepEqual(calls, []);
  assert.deepEqual(moves, ["approved->applying", "applying->failed Unknown capability: catalog.product.gone"]);
});

test("reverting undoes every item in reverse order and ends reverted", async () => {
  const { calls, moves, steps } = buildRun(buildChangeSet({ state: "applied" }));

  await revertChangeSet(steps);

  assert.deepEqual(calls, ["revert 2", "revert 1", "revert 0"]);
  assert.deepEqual(moves, ["applied->reverting", "reverting->reverted"]);
});

test("a missing change set is not found", async () => {
  const { steps } = buildRun(buildChangeSet({ state: "approved" }));

  await assert.rejects(applyChangeSet({ ...steps, findSet: async () => undefined }), { message: "Change set not found" });
  await assert.rejects(revertChangeSet({ ...steps, findSet: async () => undefined }), { message: "Change set not found" });
});
