# Session log entry — 2026-11-16, task 3 opened; conflict markers found

**What happened:** #26 was merged while the previous turn was running, so task 3 was replayed onto main, re-checked and opened as #28. The session log on main was found to hold three conflict-marker lines from an earlier cherry-pick; a fix pushed to #27 arrived after #27 had merged, so it was reopened as #29.

**Key changes:**
- #28: the server resolves the tenant from the request host. 198 counted lines.
- #29: removes the three marker lines from `session-log.md`.
- Checks for #28 on its new base: typecheck clean, 23 tests pass, both database tests pass on the development database, the real server loaded tenancy and catalog.

**Artifacts:**
- [E] Commits were pushed to #27's branch after #27 had merged, so they never reached main — fix: read a pull request's state before pushing to its branch [settled] [2026-11-16]
- [D] Log entries that would conflict with an open pull request go in their own file under `docs/journal/` — invalidates if the owner wants a single log file [medium] [2026-11-16]

**Next steps:**
- Owner to merge #28 and #29.
