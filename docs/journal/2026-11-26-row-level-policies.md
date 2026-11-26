# Session log entry — 2026-11-26, work package 15 task 7: row-level security for the catalog

**What happened:** Task 8 went up as #148 (CI passes). Its log entry and the critical `_context.md` row are on that branch. Each module now connects as its own role without `BYPASSRLS`, so the row-level security policies of task 7 can be tested, and this branch is built from `main` for them.

**Key changes:**
- `packages/core/src/tenant-scope.ts`:
  - `scopeToTenant` wraps a module's Prisma client so every model query runs in a transaction that first runs `set_config('app.tenant_id', <tenant>, true)`. The setting is local to that transaction, so it never leaks across pooled connections.
  - `readQueryTenant` takes the tenant from `where.tenantId` or `data.tenantId`, or gives "".
- The catalog adapter uses it.
- Migration `20261126000000_row_level_security` enables row-level security on `products` and `variants`, with a `tenant_rows` policy: `tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid` for both reading and writing. It was applied to the development database.
- Test as `market_catalog` (it runs when both URLs are set, and is skipped in CI):
  - A product is seen by its own tenant only.
  - A query that leaves out the tenant filter sees no rows.
  - A write without the tenant set is refused.
  - The owner is not bound.
  It passed on the development database.
- With the server's catalog on its role, the storefront lists 6 products and a purchase pays, with no policy errors in the log. `pnpm test`: 294 pass.
- The other eight modules follow in later pull requests, one or two at a time, each with its own policy migration.

**Artifacts:**
- [D] Row-level security goes module by module through `scopeToTenant`, so a module is protected once its adapter is wrapped and its migration applied, and the others keep working meanwhile — invalidates never [high] [2026-11-26]
- [I] Policies only bite when a module connects as its `market_<schema>` role (from `.env.module-roles`). Their test must sign in as that role, not as `postgres` — invalidates never [high] [2026-11-26]

**Next steps:**
- Row-level security for the remaining modules (tenancy needs care: resolving a host comes before any tenant is known).
- Work package 14 task 3: the change set page.
