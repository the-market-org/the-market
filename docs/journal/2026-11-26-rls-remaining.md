# Session log entry — 2026-11-26, after pages and carts row-level security, before the remaining modules

**What happened:** Row-level security for pages and carts went up as #156 (it includes #149), and CI passes. The real purchase and store creation flows passed with policies on catalog, pages and carts. This branch is built from #156's branch for the remaining modules.

**Key changes:**
- No code yet. This branch, `feat/rls-remaining`, carries #149's and #156's commits.
- The loop's one-shot wakeup (`e64f842b`, 11:59, `/loop keep going`) starts the work here.
- `_context.md` is unchanged: nothing this turn was critical or volatile.

**Artifacts:**
- [I] The experiments module has raw SQL (`countMetric`). `scopeToTenant` wraps model queries only, so that query needs its own `set_config` inside the same transaction, or it will count no rows — invalidates when the raw query is replaced by model queries [high] [2026-11-26]

**Next steps:**
- Audit and wrap orders, apps, experiments (including its raw query), changes and connections. Then tenancy, which resolves hosts before any tenant is known.
