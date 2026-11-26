# Session log entry — 2026-11-26, work package 15 task 8: one database role per module

**What happened:** The owner asked how to create the database user that task 8 needs. The database showed that the existing `postgres` user already has `CREATEROLE`, so none was needed. The owner approved building and running the role script on the development database. It created one role per module, and the app ran end to end with every module on its own role.

**Key changes:**
- `scripts/create-module-roles.ts`:
  - It creates or updates `market_<schema>` for the nine module schemas, as `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`, with a random password.
  - It grants DML on its own schema's tables and sequences, plus default privileges for future tables.
  - Names and passwords are checked against strict patterns before they go into SQL.
  - It writes `<SCHEMA>_DATABASE_URL` lines to `.env.module-roles`, which is git-ignored and mode 600. On the pooler the user is `<role>.<project ref>`. No password is printed.
- `compose-modules.ts`: `selectModuleUrl` uses a module's own `<SCHEMA>_DATABASE_URL` when it is set, and the shared `DATABASE_URL` otherwise. `pnpm dev` and `pnpm seed` load `.env.module-roles`.
- Migrations (`pnpm db`) still run as the owner, who owns the tables.
- Ran on the development database: 9 roles were created and 9 settings written.
- Checked as `market_catalog`:
  - `rolbypassrls` is false.
  - It reads `catalog.products` (24 rows).
  - It is refused `orders.orders` and `tenancy.tenant` (`permission denied for schema`).
- With the server on all nine roles:
  - A storefront purchase was paid (order 22, £36.00).
  - The create-store check passed: store, tokens, seed, a change set applied, and 3 signed events.
  - The server log shows no permission errors.
- `pnpm test`: 296 pass.

**Artifacts:**
- [D] At run time each module connects as its own role without `BYPASSRLS`, while migrations run as the owner. A module that reaches into another's schema now fails with `permission denied` — invalidates never [critical] [2026-11-26]
- [S] Row-level security (task 7) can now be tested as the module roles. The next step is policies, with `app.tenant_id` set per transaction — activates now [high] [2026-11-26]

**Closing state:**
- #148 is open and CI passes.
- `_context.md` gained the critical row for per-module roles in the same commit.
- The loop's one-shot wakeup (`ea2d0a86`, 08:45) goes on to task 7.

**Next steps:**
- Task 7: row-level security policies, tested as `market_<schema>`.
- Work package 14 task 3: the change set page.
