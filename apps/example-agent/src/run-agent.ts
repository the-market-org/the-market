/** The example agent's run: read the store, build one change set, ask the merchant, and optionally wait. */
import type { PlannedCall, buildStarterPlan } from "./starter-plan.ts";

type CallTool = (input: { name: string; toolArguments: Record<string, unknown> }) => Promise<unknown>;

/** States in which the merchant has not decided yet. */
const UNDECIDED_STATES: readonly string[] = Object.freeze(["TASK_STATE_INPUT_REQUIRED", "TASK_STATE_WORKING"]);

/** Refuses a store that does not offer the tool the plan needs. */
export async function requireTool(input: { toolName: string; listToolNames: () => Promise<string[]> }): Promise<void> {
  if (!(await input.listToolNames()).includes(input.toolName)) {
    throw new Error(`The store does not offer ${input.toolName}`);
  }
}

/** Runs each planned call into the change set, in order. */
export async function addPlannedCalls(input: { calls: PlannedCall[]; changeSetId: string; callTool: CallTool; writeLine: (line: string) => void }): Promise<void> {
  for (const call of input.calls) {
    const item = (await input.callTool({ name: call.name, toolArguments: { ...call.toolArguments, changeSetId: input.changeSetId } })) as { summary: string };
    input.writeLine(`Added: ${item.summary}`);
  }
}

/** Polls the task until the merchant has decided, or gives up. Never approves. */
export async function waitForDecision(input: {
  changeSetId: string;
  readTaskState: (input: { changeSetId: string }) => Promise<string>;
  pauseFor: (milliseconds: number) => Promise<void>;
  waitPolls: number;
}): Promise<string> {
  for (let pollCount = 0; pollCount < input.waitPolls; pollCount += 1) {
    const state = await input.readTaskState({ changeSetId: input.changeSetId });
    if (!UNDECIDED_STATES.includes(state)) {
      return state;
    }
    await input.pauseFor(2000);
  }
  throw new Error(`Gave up waiting after ${input.waitPolls} checks`);
}

export async function runExampleAgent(input: {
  storeName: string;
  callTool: CallTool;
  listToolNames: () => Promise<string[]>;
  askApproval: (input: { changeSetId: string }) => Promise<string>;
  readTaskState: (input: { changeSetId: string }) => Promise<string>;
  buildPlan: typeof buildStarterPlan;
  requireOffered: typeof requireTool;
  addCalls: typeof addPlannedCalls;
  waitFor: typeof waitForDecision;
  pauseFor: (milliseconds: number) => Promise<void>;
  waitPolls: number;
  writeLine: (line: string) => void;
}): Promise<{ changeSetId: string; finalState: string }> {
  await input.requireOffered({ toolName: "pages.page.set-sections", listToolNames: input.listToolNames });
  const products = (await input.callTool({ name: "store.products.list", toolArguments: {} })) as unknown[];
  const created = (await input.callTool({ name: "store.change-set.create", toolArguments: { title: `Starter store for ${input.storeName}` } })) as { changeSetId: string };
  const { changeSetId } = created;
  await input.addCalls({ calls: input.buildPlan({ storeName: input.storeName, productCount: products.length }), changeSetId, callTool: input.callTool, writeLine: input.writeLine });
  const askedState = await input.askApproval({ changeSetId });
  input.writeLine(`Waiting for the merchant to review change set ${changeSetId}`);
  input.writeLine(`Preview: /api/change-sets/${changeSetId}/preview/home`);
  const finalState = input.waitPolls > 0 ? await input.waitFor({ changeSetId, readTaskState: input.readTaskState, pauseFor: input.pauseFor, waitPolls: input.waitPolls }) : askedState;
  input.writeLine(`Task state: ${finalState}`);
  return { changeSetId, finalState };
}
