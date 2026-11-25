# Session log entry — 2026-11-25, after work package 11 task 4b

**What happened:** Task 4b, variant pages, went up as #128. Its real check found that waiting for the exposure write showed some variant visitors the live page, so the page now uses the hashed arm and records the exposure without waiting. #116 to #121 merged in this turn. Main was merged into #127 and #128, which fixed their slots and telemetry conflict, and every open pull request now merges cleanly.

**Key changes:**
- CI on #123 failed: `experiments.exposures` did not exist, because `.github/workflows/ci.yml` migrated each module by name and `experiments` was missing. The step was added on #123's branch and merged into every branch after it. CI now passes on #123 to #128.
- Pushing the feature branches printed "Bypassed rule violations … Changes must be made through a pull request", so a branch rule now covers feature branches, and the account bypasses it.
- #128: `variant-pages.ts`, with the variant's sections shown to variant visitors. The plan was updated for the non-blocking exposure write.
- #127's branch: main merged in and the `compose-storefront.ts` conflict fixed. Pushed.
- This branch, for task 5, starts from #128.

**Artifacts:**
- [D] An experiment's arm is decided only by the stable hash. The stored exposure is a record of what was shown and never changes what is shown — invalidates if traffic percent can change while an experiment runs [high] [2026-11-25]

- [E] A new module with a database test needs its own `pnpm db <module> migrate deploy` line in CI. Local runs pass because the development database is already migrated. Fix: add the line in the pull request that adds the module's tables, and read CI on every new pull request — invalidates when CI migrates every module from one list [high] [2026-11-25]

**Next steps:**
- Task 5: `GET /api/experiments`, `GET /api/experiments/:experimentId` with live counts, `POST /api/experiments/:experimentId/decide` and `POST /api/experiments/:experimentId/adopt`.
