# Session log entry — 2026-11-17, work package 3 task 1: capability types and collection

**What happened:** #32 and #33 were confirmed merged, so work package 2 is complete. Work package 3 started: modules can now declare capabilities, and the core collects them into one registry.

**Key changes:**
- `packages/core/src/capability-types.ts`: `RiskTier`, `ChangeItem`, `CapabilityDefinition`, `CapabilityRegistry`, as in the plan.
- `ModuleDefinition` gains the optional `listCapabilities({ services })`.
- `packages/core/src/capability-registry.ts`: `collectCapabilities` fails at start-up on a duplicate name (`Capability "<name>" is declared twice`) or a name outside its module (`Capability "<name>" must start with "<module>."`).
- Differs from the plan: `collectCapabilities` also takes `listDeclared` and `addOne`, the two helpers it calls, so it follows the rule that called functions are passed in. Both helpers are exported.
- Checks: typecheck clean; 39 tests pass, 2 database tests skipped locally.

**Artifacts:**
- [D] Capability names are checked when the server starts, so a clash stops start-up instead of overwriting — invalidates if capabilities can be added while running [medium] [2026-11-17]

**Next steps:**
- Owner to merge this pull request.
- Then work package 3, task 2: input checking.
