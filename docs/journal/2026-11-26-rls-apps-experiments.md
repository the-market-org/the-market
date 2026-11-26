# Session log entry — 2026-11-26, after orders and changes row-level security, before apps, experiments and connections

**What happened:** Row-level security for orders and changes went up as #157 (it includes #156 and #149), and CI passes. A purchase and a store creation passed with every module on its own role. This branch is built from #157's branch for the next modules.

**Key changes:**
- No code yet. This branch, `feat/rls-apps-experiments`, carries #149's, #156's and #157's commits.
- The loop's one-shot wakeup (`e829e2ee`, 12:11, `/loop keep going`) starts the work here.
- `_context.md` is unchanged: nothing this turn was critical or volatile.

**Artifacts:**
- [I] Policies now cover catalog, pages, carts, orders and changes. Apps, experiments, connections and tenancy are left, and tenancy needs a read path for host resolution before any tenant is known — invalidates when all modules are covered [medium] [2026-11-26]

**Next steps:**
- Audit the apps, experiments and connections adapters. Experiments' raw `countMetric` must run in the same tenant transaction.
