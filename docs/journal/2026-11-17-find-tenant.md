# Session log entry — 2026-11-17, tenancy can find a tenant by id

**What happened:** The storefront needs the store's name, so the tenancy module gained a lookup by tenant id. Stacked on #72.

**Key changes:**
- `TenancyDatabase.findTenantById` and the service `findTenant({ tenantId })`; a non-UUID id returns nothing without a query, as in the other adapters.
- Checks: typecheck clean; 131 tests pass, 5 database tests skipped locally. The service test was seen failing first; the tenancy database test passed three runs in a row on the development database.

**Next steps:**
- Work package 6, task 6: storefront routes.
