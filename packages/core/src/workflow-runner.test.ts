import assert from "node:assert/strict";
import { test } from "node:test";
import { runWorkflow, undoCompletedSteps } from "./workflow-runner.ts";
import type { WorkflowStep } from "./workflow-runner.ts";

function buildSteps(input: { failAt?: number; failUndoAt?: number; calls: string[] }): WorkflowStep<number>[] {
  return [0, 1, 2].map((stepIndex) => ({
    stepName: `step ${stepIndex}`,
    run: async (state) => {
      input.calls.push(`run ${stepIndex} with ${state}`);
      return stepIndex === input.failAt ? Promise.reject(new Error("payment declined")) : state + 10;
    },
    undo: async (state) => {
      input.calls.push(`undo ${stepIndex} with ${state}`);
      return stepIndex === input.failUndoAt ? Promise.reject(new Error("order locked")) : undefined;
    },
  }));
}

function run(steps: WorkflowStep<number>[]) {
  return runWorkflow({ steps, initialState: 0, describe: (error) => (error as Error).message, undoSteps: undoCompletedSteps });
}

test("steps run in order, each with the state the one before returned", async () => {
  const calls: string[] = [];
  assert.equal(await run(buildSteps({ calls })), 30);
  assert.deepEqual(calls, ["run 0 with 0", "run 1 with 10", "run 2 with 20"]);
});

test("a failing step undoes the earlier steps in reverse, each with the state it produced", async () => {
  const calls: string[] = [];
  await assert.rejects(run(buildSteps({ failAt: 2, calls })), { message: "step 2 failed: payment declined" });
  assert.deepEqual(calls, ["run 0 with 0", "run 1 with 10", "run 2 with 20", "undo 1 with 20", "undo 0 with 10"]);
});

test("a failing undo does not stop the other undos and is named", async () => {
  const calls: string[] = [];
  await assert.rejects(run(buildSteps({ failAt: 2, failUndoAt: 1, calls })), {
    message: "step 2 failed: payment declined; undo of step 1 failed: order locked",
  });
  assert.deepEqual(calls.slice(-2), ["undo 1 with 20", "undo 0 with 10"]);
});
