# Session log entry — 2026-11-26, row-level security for pages and carts

**What happened:** Work package 14 is built and its real check passed (#155, CI passes). #148 to #155 are waiting for merge. This branch is built from #149's branch (catalog row-level security, with `scopeToTenant`) to extend the policies to more modules.

**Key changes:**
- This branch carries #149's commits.
- The audit found two upserts that name the tenant only inside a compound key (`tenantId_pageKey`) or in `create` (`cart_lines`).
- `readQueryTenant` now also reads a compound unique key's `tenantId` and an upsert's `create.tenantId`, and the catalog test covers both.
- The pages and carts adapters are wrapped with `scopeToTenant`.
- Migrations add the `tenant_rows` policy to `pages`, `carts` and `cart_lines`. They were applied to the development database.
- Test as `market_carts`:
  - A cart and its line belong to their tenant.
  - The upsert keyed without the tenant updates the tenant's line (quantity 3).
  - Another tenant sees no cart.
  - A query that names no tenant sees no lines.
  It passed twice on the development database. One earlier run failed on a dropped connection, not on the code.
- With every module on its own role and policies on catalog, pages and carts:
  - A purchase added 1, then 2 more, and paid "3 × Rope lead £54.00".
  - The store creation check passed: a page change set was applied, the home page changed, and 3 signed events arrived.
  - The server logs show no permission or policy errors.
- `pnpm test`: 296 pass.- `_context.md` is unchanged: nothing this turn was critical or volatile.

**Artifacts:**
- [I] Before a module's adapter is wrapped with `scopeToTenant`, each of its queries must name `tenantId` at the top of `where` or `data`. A nested-only tenant filter would be read as no tenant, and the query would see no rows — invalidates when `readQueryTenant` reads nested filters [high] [2026-11-26]

**Next steps:**
- Row-level security for orders, apps, experiments, changes and connections. Tenancy last, because resolving a host comes before any tenant is known.
