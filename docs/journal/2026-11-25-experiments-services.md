# Session log entry — 2026-11-25, work package 11 task 3a: experiments services

**What happened:** The loop paused after opening #124, with a wakeup set for task 3. No pull request from #116 to #124 had merged. Task 3 starts on this branch, which merges #123 (the adapter) and #124 (the statistics), so its pull request will say "Includes #123, #124".

**Key changes:**
- `experiments-services.ts` provides `startExperiment`, `stopExperiment`, `findExperiment`, `listExperiments`, `findRunningExperiment`, `recordEvent`, `recordExposure`, `measureExperiment`, `decideExperiment` and `markAdopted`.
- `recordEvent` takes only `page_view`, `add_to_cart` and `checkout_paid`.
- `decideExperiment` works only on a running experiment that has passed its end. It decides once, and the outcome keeps the numbers. It refuses with `Experiment is still running` or `Experiment is not running`.
- The module is registered and loaded by the server. The server started on the development database: health 200, product page 200.
- The `experiments.start` capability comes in the next pull request. It needs the changes module's `findChangeSet`, so the server adds it after the modules are loaded.

**Artifacts:**
- [D] Task 3 needs the adapter and the statistics together, so its branch merges both open pull requests rather than waiting — invalidates when #123 and #124 merge, after which it rebases on `main` [medium] [2026-11-25]

**Next steps:**
- Task 3b: the `experiments.start` capability, wired in `compose-modules.ts`.
