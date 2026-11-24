/**
 * Runs a workflow's steps in order. When one fails, the steps before it are undone in
 * reverse, each with the state it produced, so a workflow leaves nothing half done.
 */

export interface WorkflowStep<State> {
  stepName: string;
  run: (state: State) => Promise<State>;
  undo: (state: State) => Promise<void>;
}

/** Undoes completed steps last first; a failing undo is noted and the others still run. Returns the full message. */
export async function undoCompletedSteps<State>(input: {
  steps: readonly WorkflowStep<State>[];
  states: readonly State[];
  failure: string;
  describe: (error: unknown) => string;
}): Promise<string> {
  const notes: string[] = [];
  for (let stepIndex = input.steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const step = input.steps[stepIndex] as WorkflowStep<State>;
    await step.undo(input.states[stepIndex] as State).catch((error: unknown) => notes.push(`undo of ${step.stepName} failed: ${input.describe(error)}`));
  }
  return [input.failure, ...notes].join("; ");
}

export async function runWorkflow<State>(input: {
  steps: readonly WorkflowStep<State>[];
  initialState: State;
  describe: (error: unknown) => string;
  undoSteps: typeof undoCompletedSteps;
}): Promise<State> {
  const states: State[] = [];
  let state = input.initialState;
  for (const [stepIndex, step] of input.steps.entries()) {
    try {
      state = await step.run(state);
      states.push(state);
    } catch (error) {
      const failure = `${step.stepName} failed: ${input.describe(error)}`;
      throw new Error(await input.undoSteps({ steps: input.steps.slice(0, stepIndex), states, failure, describe: input.describe }));
    }
  }
  return state;
}
