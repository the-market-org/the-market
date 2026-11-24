# Session log entry — 2026-11-24, work package 10 task 2: apps services

**What happened:** The apps module now registers apps, takes the store owner's decision, and keeps slot bindings for active apps only. A pull request on `main` after #112 merged.

**Key changes:**
- `apps-services.ts`: `registerApp` (status from the authoriser's answer: `allowed` → `active`, `refused` → `refused`, `pending` → `pending`; the same address again returns the app already there), `decideApp` (only from `pending`; `App not found`, `App is not waiting for a decision`, `Invalid input: decision must be allowed or refused`), `listApps`, `findApp`, `setBinding` (active apps only: `App is not active`), `findBinding`, `removeBinding`, `listBindings`.
- Checks: typecheck clean; 222 tests pass, 9 database tests skipped locally. Tests seen failing first.

**Next steps:**
- Owner to merge this pull request; then the install routes (task 3).
