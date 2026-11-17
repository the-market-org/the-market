# Session log entry — 2026-11-17, work package 4 task 5: apply and revert, all or nothing

**What happened:** Change sets can now be applied and reverted through the capability registry. At 245 lines the task was split in two stacked pull requests: the item-level steps first, then the change set workflows.

**Key changes:**
- `item-steps.ts`: `applyItem` and `revertItem` (look the capability up by name, `Unknown capability: <name>` when gone), `applyItemsInOrder` (stops at the first failure and reports how many applied), `revertItemsInReverse` (last first; a failure stops with `Revert stopped at item <position>: <message>`), `describeError`.
- `apply-workflow.ts` (second pull request): `applyChangeSet` moves `approved → applying`, applies in order, and on a failure reverts the applied items, moves to `failed` with the message stored, and rejects with it; otherwise moves to `applied`. `revertChangeSet` moves `applied → reverting`, reverts last first, then `reverted`.
- A revert that fails leaves the set in `applying` or `reverting`, visible for manual repair; retrying is not in this package.
- Checks: typecheck clean; 77 tests pass, 4 database tests skipped locally. New tests seen failing first.

**Artifacts:**
- [S] A command to finish a stuck `reverting` or `applying` change set — activates when one is seen outside tests [medium] [2026-11-17]

**Next steps:**
- Work package 4, task 6: the merchant token guard.
