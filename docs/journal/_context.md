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
| E | The app's database user `postgres` has `BYPASSRLS` and owns the tables, so row-level security does nothing until each module connects as its own role (work package 15 task 8, needs the owner) | The app stops connecting as `postgres` | critical | 2026-11-26 | `2026-11-26-row-level-security.md` |
