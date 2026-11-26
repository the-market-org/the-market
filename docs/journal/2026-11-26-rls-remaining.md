# Session log entry — 2026-11-26, row-level security for orders and changes

**What happened:** Row-level security for pages and carts went up as #156 (it includes #149), and CI passes. The real purchase and store creation flows passed with policies on catalog, pages and carts. This branch is built from #156's branch for the remaining modules.

**Key changes:**
- This branch carries #149's and #156's commits.
- The audit found that orders (the next order number) and changes (the next item position) run interactive transactions. `scopeToTenant` opens a transaction per query, which cannot nest inside those.
- `runAsTenant({ client, tenantId, work })` (core) runs the work in one interactive transaction that first sets `app.tenant_id`. Every orders and changes adapter method now runs through it.
- Migrations add `tenant_rows` to `orders`, `order_lines`, `change_sets` and `change_items`. They were applied to the development database.
- Test as `market_orders`:
  - Two orders for store A are numbered 1 and 2, and store B's first is 1.
  - Store B cannot find or pay store A's order.
  - A query that names no store sees none.
  It passed, and so did the owner's orders and changes database tests.
- With every module on its own role:
  - A purchase paid order 25 (£18.00).
  - The store creation check passed: a change set was applied, and 3 signed events arrived.
  - The first try failed with a 500 whose reference led to "Can't reach database server", a passing outage, not the code.
- `pnpm test`: 294 pass.- `_context.md` is unchanged: nothing this turn was critical or volatile.

**Artifacts:**
- [D] A module whose writes need their own interactive transaction uses `runAsTenant` instead of `scopeToTenant` — invalidates when Prisma lets a query extension join an open interactive transaction [high] [2026-11-26]
- [I] The experiments module has raw SQL (`countMetric`). `scopeToTenant` wraps model queries only, so that query needs its own `set_config` inside the same transaction, or it will count no rows — invalidates when the raw query is replaced by model queries [high] [2026-11-26]

**Next steps:**
- Apps, experiments (including its raw query) and connections. Then tenancy, which resolves hosts before any tenant is known.
