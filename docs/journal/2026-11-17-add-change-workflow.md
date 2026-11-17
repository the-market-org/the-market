# Session log entry — 2026-11-17, work package 4 task 3: the add-change workflow

**What happened:** Adding a capability change to a change set now goes through one workflow in the server, stacked on #44.

**Key changes:**
- `apps/server/src/change-sets/add-change-workflow.ts`: `addChangeToSet` finds the capability (`Unknown capability: <name>`), checks the input (`Invalid input: <problems>`), runs `buildChange`, then stores the item. Nothing is stored when any step fails.
- The capability is looked up through a `Map`, so names such as `toString` are unknown rather than matching built-in object members.
- Checks: typecheck clean; 63 tests pass, 4 database tests skipped locally. New tests seen failing first.

**Artifacts:**
- [E] A plain object lookup would let `toString` look like a capability — fix: look capabilities up through a `Map` or `Object.hasOwn` [settled] [2026-11-17]

**Next steps:**
- Work package 4, tasks 4 and 5: approve, reject, apply and revert workflows.
