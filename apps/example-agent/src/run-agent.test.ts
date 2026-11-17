import assert from "node:assert/strict";
import { test } from "node:test";
import { addPlannedCalls, requireTool, runExampleAgent, waitForDecision } from "./run-agent.ts";
import { buildStarterPlan } from "./starter-plan.ts";

function buildRun(input: { toolNames?: string[]; failOn?: string; taskStates?: string[]; waitPolls?: number }) {
  const lines: string[] = [];
  const calls: string[] = [];
  const taskStates = [...(input.taskStates ?? [])];
  const run = () =>
    runExampleAgent({
      storeName: "Demo store",
      callTool: async (request) => {
        calls.push(request.name);
        if (request.name === input.failOn) {
          throw new Error("Section hero cannot be used on product");
        }
        const answers: Record<string, unknown> = {
          "store.products.list": [{ handle: "rope-lead" }, { handle: "chew-toy" }],
          "store.change-set.create": { changeSetId: "set_1" },
          "pages.page.set-sections": { summary: `Set sections on the ${(request.toolArguments as { pageKey: string }).pageKey} page` },
        };
        return answers[request.name];
      },
      listToolNames: async () => input.toolNames ?? ["pages.page.set-sections", "store.change-set.create", "store.products.list"],
      askApproval: async () => "TASK_STATE_INPUT_REQUIRED",
      readTaskState: async () => taskStates.shift() ?? "TASK_STATE_INPUT_REQUIRED",
      buildPlan: buildStarterPlan,
      requireOffered: requireTool,
      addCalls: addPlannedCalls,
      waitFor: waitForDecision,
      pauseFor: async () => {},
      waitPolls: input.waitPolls ?? 0,
      writeLine: (line) => lines.push(line),
    });
  return { run, lines, calls };
}

test("the agent builds the starter change set and asks for approval", async () => {
  const { run, lines, calls } = buildRun({});
  assert.deepEqual(await run(), { changeSetId: "set_1", finalState: "TASK_STATE_INPUT_REQUIRED" });
  assert.deepEqual(calls, ["store.products.list", "store.change-set.create", "pages.page.set-sections", "pages.page.set-sections"]);
  assert.deepEqual(lines, [
    "Added: Set sections on the home page",
    "Added: Set sections on the product page",
    "Waiting for the merchant to review change set set_1",
    "Preview: /api/change-sets/set_1/preview/home",
    "Task state: TASK_STATE_INPUT_REQUIRED",
  ]);
});

test("a store without the pages tool is refused before any change set is created", async () => {
  const { run, calls } = buildRun({ toolNames: ["store.change-set.create"] });
  await assert.rejects(run(), { message: "The store does not offer pages.page.set-sections" });
  assert.deepEqual(calls, []);
});

test("a failing call stops the run before approval is asked", async () => {
  const { run, lines } = buildRun({ failOn: "pages.page.set-sections" });
  await assert.rejects(run(), { message: "Section hero cannot be used on product" });
  assert.equal(lines.some((line) => line.startsWith("Waiting")), false);
});

test("waiting stops once the merchant has decided, and gives up after the polls", async () => {
  const decided = buildRun({ waitPolls: 5, taskStates: ["TASK_STATE_INPUT_REQUIRED", "TASK_STATE_WORKING", "TASK_STATE_COMPLETED"] });
  assert.equal((await decided.run()).finalState, "TASK_STATE_COMPLETED");

  const waiting = buildRun({ waitPolls: 2 });
  await assert.rejects(waiting.run(), { message: "Gave up waiting after 2 checks" });
});
