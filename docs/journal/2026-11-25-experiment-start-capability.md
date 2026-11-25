# Session log entry — 2026-11-25, work package 11 task 3b: starting experiments through change sets

**What happened:** Task 3a went up as #125, and the loop paused before task 3b. Task 3b starts on this branch, which is built from #125. Nothing from #116 to #125 had merged.

**Key changes:**
- `experiments-capabilities.ts` adds `experiments.start` (risk medium). It defaults to 50% traffic for 336 hours and refuses:
  - unknown or equal metrics;
  - traffic outside 10–90 and duration outside 1–1440 hours;
  - a variant that is not approved, or that changes anything but the experiment's page (an empty variant is refused too);
  - a page that already has a running experiment.
- Applying it starts the experiment with `ends_at` set to now plus the duration. Reverting it stops the experiment, but only if it is still running with that variant.
- `compose-modules.ts` adds the capability after the modules load, and `GET /api/capabilities` lists it.
- Checked on the development database:
  1. The variant (2 sections on the product page) was approved.
  2. The start change set was applied.
  3. A second start was refused with `An experiment is already running on product`.
  4. The revert stopped the experiment, and a new start was accepted again.
  5. An unknown host got 404.

**Artifacts:**
- [D] `experiments.start` is built in the server's module composition, because it must read the changes module's change sets and a module's own capability list sees only its own services — invalidates when modules can declare capabilities that use other modules' services [medium] [2026-11-25]

**Next steps:**
- Task 4: storefront telemetry and variant pages.
