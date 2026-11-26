# Session log entry — 2026-11-26, before work package 15 task 7: row-level security policies

**What happened:** Task 8 went up as #148 (CI passes). Its log entry and the critical `_context.md` row are on that branch. Each module now connects as its own role without `BYPASSRLS`, so the row-level security policies of task 7 can be tested, and this branch is built from `main` for them.

**Key changes:**
- No code yet. This branch, `feat/row-level-policies`, is for task 7.
- The loop's one-shot wakeup (`ea2d0a86`, 08:45) starts the work here.

**Artifacts:**
- [I] Policies only bite when a module connects as its `market_<schema>` role (from `.env.module-roles`). Their test must sign in as that role, not as `postgres` — invalidates never [high] [2026-11-26]

**Next steps:**
- Task 7, starting with the catalog module: a Prisma client extension that runs each query in a transaction after `set_config('app.tenant_id', …, true)`, a migration with `ENABLE ROW LEVEL SECURITY` and a policy, and a database test as `market_catalog` that leaves out the tenant filter on purpose.
