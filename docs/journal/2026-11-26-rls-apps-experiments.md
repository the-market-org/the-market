# Session log entry — 2026-11-26, row-level security for apps, experiments and connections

**What happened:** Row-level security for orders and changes went up as #157 (it includes #156 and #149), and CI passes. A purchase and a store creation passed with every module on its own role. This branch is built from #157's branch for the next modules.

**Key changes:**
- This branch carries #149's, #156's and #157's commits. `main` was merged in for #153's `merchant_messages` table.
- The audit found:
  - No interactive transactions in these three modules.
  - Every model query names its tenant at the top, in a compound key (`tenantId_slotName_appId`), or in an upsert's `create` (exposures).
- The apps, experiments and connections adapters are wrapped with `scopeToTenant`. Experiments' raw `countMetric` runs through `runAsTenant`, because the extension does not see raw queries.
- Migrations add `tenant_rows` to `apps`, `app_slot_bindings`, `telemetry_events`, `experiments`, `exposures`, `agent_connections` and `merchant_messages`. They were applied to the development database after a two-minute outage, when port 5432 was open but the pooler refused.
- Test as `market_experiments`:
  - The raw metric query counts the variant visitor for store A and nothing for store B.
  - Store B has no running experiment.
  - Raw SQL without the tenant set sees no exposures.
  It passed, and so did the owner's apps, experiments and connections database tests.
- With every module on its own role:
  - The store creation check passed (connections, with 3 signed events).
  - The product page answered 200 (experiments and app slots).
  - The admin experiments page listed 4 experiments, with the adopted one's numbers, and the apps page listed "Review stars, active".
  - The logs show no permission or policy errors.
- `pnpm test`: 305 pass.- `_context.md` is unchanged: nothing this turn was critical or volatile.

**Artifacts:**
- [I] Policies now cover catalog, pages, carts, orders and changes. Apps, experiments, connections and tenancy are left, and tenancy needs a read path for host resolution before any tenant is known — invalidates when all modules are covered [medium] [2026-11-26]

**Next steps:**
- Tenancy: host resolution reads the `tenant` table before any tenant is known, so it needs a policy that allows that lookup only, or a narrowly granted function.
