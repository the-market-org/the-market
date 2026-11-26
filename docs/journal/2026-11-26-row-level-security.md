# Session log entry — 2026-11-26, before work package 15 task 7: row-level security

**What happened:** Task 6 went up as #144 (CI passes, exactly 200 counted lines). Its log entry holds the closing state. This branch is built from `main` for task 7, row-level security.

**Key changes:**
- No code yet on this branch.

**Context table checked:**
- Task 6's artifacts are high (run the migration only with the owner's key) and medium (the key is required in production only). Neither is critical or volatile, so `_context.md` is unchanged.

- The only scheduled job is the loop's one-shot wakeup (`dc4cf262`, 08:15, `/loop keep going`), which builds task 7.

**Artifacts:**
- [I] Row-level security needs each module's queries to run in a transaction that sets `app.tenant_id`. On the Supabase pooler, that setting must be local to the transaction (`set_config(..., true)`), or it would leak between pooled connections — invalidates when the module clients connect directly [high] [2026-11-26]

**Next steps:**
- Task 7: a Prisma client extension that sets `app.tenant_id` per query, plus policies and migrations, starting with the catalog module.
