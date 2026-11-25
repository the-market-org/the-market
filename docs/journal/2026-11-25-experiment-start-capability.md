# Session log entry — 2026-11-25, work package 11 task 3b: starting experiments through change sets

**What happened:** Task 3a went up as #125, and the loop paused before task 3b. Task 3b starts on this branch, which is built from #125. Nothing from #116 to #125 had merged.

**Key changes:**
- This branch starts from #125 and will hold the `experiments.start` capability and its wiring in `compose-modules.ts`.

**Artifacts:**
- [D] `experiments.start` is built in the server's module composition, because it must read the changes module's change sets and a module's own capability list sees only its own services — invalidates when modules can declare capabilities that use other modules' services [medium] [2026-11-25]

**Next steps:**
- Build the capability. Its `buildChange` checks that the variant change set is approved, changes only the experiment's page, uses two different metrics, and that the page has no running experiment. Its revert stops the experiment.
