# Session log entry — 2026-11-17, work package 1 task 4: catalog scoped by tenant

**What happened:** The owner asked to read the docs and keep going. #28 and #29 were still open, but task 4 only touches the catalog module, so it was built on main without depending on them. Catalog products and variants now carry a tenant id, and two stores can use the same handle and SKU without seeing each other's products.

**Key changes:**
- Schema: `tenant_id` on `products` and `variants`; uniqueness is per tenant (`tenant_id, handle` and `tenant_id, sku`); an index on `tenant_id` in both tables.
- Migration `20261116010000_add_tenant_id`, generated without a database. The development tables were checked empty before it was applied, as a required column cannot be added to rows that exist.
- Services: `NewProduct` and `listProducts` take `tenantId`; the `catalog.product.created` event carries `tenantId`.
- Adapter: the only place that filters by tenant.
- Checks: typecheck clean; 21 tests pass, 2 database tests skipped locally; migration applied to the development database; both database tests pass there, including the two-tenant test.

**Artifacts:**
- [I] Catalog rows are isolated per tenant at the adapter, proven by the two-tenant database test — invalidates if a query is added outside the adapter [high] [2026-11-17]
- [I] `prisma db execute` does not print query results; reading data needs a client and `$queryRaw` — invalidates never [low] [2026-11-17]
- [D] Owner rule kept: no tool attribution lines in commits or pull requests, even when a harness default asks for them — invalidates only if the owner changes it [critical] [2026-11-17]

**Next steps:**
- Owner to merge #28, #29 and this pull request; work package 1 is then complete.
- Then work package 2, task 1: seed functions.
