# Session log entry — 2026-11-26, work package 15 task 7 waits for task 8

**What happened:** Task 6 went up as #144 (CI passes, exactly 200 counted lines). Its log entry holds the closing state. This branch is built from `main` for task 7, row-level security.

**Key changes:**
- The database was asked who the app is. `current_user` is `postgres`, with `rolsuper` false and `rolbypassrls` true, and `pg_tables` lists `postgres` as the owner of `catalog.products`. So row-level security policies would not apply to the app's own queries.
- The plan now runs task 8 (one role per module, without `BYPASSRLS`) before task 7. Task 8 needs the owner: a database user allowed to create roles, and the owner runs the role script.

**Context table checked:**
- Task 6's artifacts are high (run the migration only with the owner's key) and medium (the key is required in production only). Neither is critical or volatile, so `_context.md` is unchanged.

- The only scheduled job is the loop's one-shot wakeup (`dc4cf262`, 08:15, `/loop keep going`), which builds task 7.

**Artifacts:**
- [E] Policies written while the app connects as `postgres` (`BYPASSRLS`, table owner) would pass every test and protect nothing. Fix: give each module its own role without `BYPASSRLS`, and test the policies as that role — invalidates when the app no longer connects as `postgres` [critical] [2026-11-26]
- [I] Row-level security needs each module's queries to run in a transaction that sets `app.tenant_id`. On the Supabase pooler, that setting must be local to the transaction (`set_config(..., true)`), or it would leak between pooled connections — invalidates when the module clients connect directly [high] [2026-11-26]

**Next steps:**
- The owner decides on task 8: a database user allowed to create roles. Meanwhile, work package 14 (the merchant screen) needs nothing from the owner.
