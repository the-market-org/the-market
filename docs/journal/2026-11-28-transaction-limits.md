# Session log entry — 2026-11-28, transactions get time to start

- **What happened:** during an agent service run on the development database, the tenant app failed twice on a cold connection to Supabase's pooler. Store creation failed with `Transaction not found` in `findTenantByHost`. The merchant screen's sign-in, approve and apply failed with P2028, "Unable to start a transaction in the given time". A retry, then a restart, got past them, and nothing was changed by the failures. The owner asked for a fix.
- **Cause:** the installed Prisma client gives an interactive transaction 2 seconds to start (`maxWait`) and 5 to finish (`timeout`). Every module's row-level security runs through `runWithSettings`, an interactive transaction. Store creation also ran its host and slug lookups as two transactions at once.
- **Key changes:**
  - `packages/core/src/tenant-scope.ts`: `TRANSACTION_LIMITS` sets 10 seconds to start and 15 to finish, passed by `runWithSettings`, and so by `runAsTenant`. It is exported.
  - `modules/tenancy/src/tenancy-services.ts`: `createStore` looks up the host, then the slug.
- **Checks:**
  - 3 new core tests: the limits are passed, the settings are applied in order before the work, and `runAsTenant` sets `app.tenant_id`.
  - 1 new tenancy test: the slug lookup starts only after the host lookup ends.
  - `pnpm test` gives 312 pass and 0 fail. The typecheck passes.
  - Live, the tenancy database and row-security tests pass as the tenancy role.
- **Artifacts:**
  - [E] Interactive transactions failed with P2028 or `Transaction not found` on a cold pooler connection, because Prisma gives 2 seconds to start. fix: `TRANSACTION_LIMITS` (10 and 15 seconds) in `runWithSettings`, and store creation's lookups in turn [high] [2026-11-28]
- **Next steps:** watch the next long-idle run for P2028. If it returns, look at the pooler's connection settings.
