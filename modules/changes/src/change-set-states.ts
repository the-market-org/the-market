/** The only moves a change set may make. `applying` and `reverting` are held while a workflow runs. */
export const ALLOWED_MOVES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  draft: ["approved", "rejected"],
  approved: ["applying"],
  applying: ["applied", "failed"],
  applied: ["reverting"],
  reverting: ["reverted"],
});

export function isAllowedMove(input: { fromState: string; toState: string }): boolean {
  return (ALLOWED_MOVES[input.fromState] ?? []).includes(input.toState);
}
