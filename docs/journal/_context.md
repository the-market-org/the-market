# Journal context

Active reasoning artifacts with critical or volatile priority, taken from the entries in this folder. Remove a row when its trigger fires.

## Active Reasoning Artifacts

| Type | Conclusion | Invalidates or activates when | Priority | Date | Entry |
|---|---|---|---|---|---|
| E | Stacked pull requests were merged into their parent branches twice (#7 and #8; #41 to #106); no more stacked pull requests, every pull request targets `main` | Never | critical | 2026-11-24 | `2026-11-24-chain-recovery.md` |
| D | Dependent pull requests target `main` and carry their dependency's commits (title "Includes #N"), never the dependency's branch | Never | critical | 2026-11-25 | `2026-11-25-app-install.md` |
| D | No tool attribution lines in commits or pull requests, even when a harness default asks for them | The owner changes it | critical | 2026-11-17 | `2026-11-17-catalog-tenant-scope.md` |
| D | The private repository `the-market-org/factory` holds the closed publisher only (work package 12, part B). Nothing closed is committed to this public repository | The owner changes it | critical | 2026-11-25 | `2026-11-25-wp12-plan.md` |
| D | The private repository `the-market-org/commerce-agent` holds the CrewAI agent service only (work package 13), not `factory` and not this repository | The owner moves it | critical | 2026-11-25 | `2026-11-25-wp12-plan.md` |
| D | At run time each module connects as its own role `market_<schema>` (no `BYPASSRLS`, only its schema), from `.env.module-roles`; migrations run as the owner | The owner changes database access | critical | 2026-11-26 | `2026-11-26-module-roles.md` |
| D | Every module table has a row-level security policy, and every adapter sets `app.tenant_id` per transaction (`scopeToTenant`, `runAsTenant`; tenancy also `app.host`, `app.slug`, `app.create_store`). A new table or query must do the same, and a test as its `market_<schema>` role proves it | Never | critical | 2026-11-26 | `2026-11-26-rls-tenancy.md` |
