# Session log entry — 2026-11-17, work package 5 task 5: owner authoriser

**What happened:** The default app authoriser asks the store owner: an app is pending until the owner records a decision. Stacked on #59.

**Key changes:**
- `owner-authoriser.ts`: `buildOwnerAuthoriser()` with `decideApp`, `recordDecision` and `listPending`.
- A decision covers only the permissions asked for when it was recorded; asking for more is pending again. A decision for an app that never asked is ignored, so nothing is allowed without a request first.
- Kept in memory; work package 10 stores decisions.
- Checks: typecheck clean; 106 tests pass, 4 database tests skipped locally. Tests seen failing first.

**Artifacts:**
- [D] The owner authoriser never allows an app without a recorded decision on a pending request — invalidates never [high] [2026-11-17]

**Next steps:**
- Work package 5, task 6: merchants sign in with an identity token.
