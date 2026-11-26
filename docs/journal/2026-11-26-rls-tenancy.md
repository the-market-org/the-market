# Session log entry — 2026-11-26, after apps, experiments and connections row-level security, before tenancy

**What happened:** Row-level security for apps, experiments and connections went up as #158 (it includes #157, #156 and #149), and CI passes. Every module except tenancy now binds its role to one tenant. This branch is built from #158's branch for the last module.

**Key changes:**
- No code yet. This branch, `feat/rls-tenancy`, carries #158's commits.
- The loop's one-shot wakeup (`82c99013`, 16:00, `/loop keep going`) starts the work here.
- `_context.md` is unchanged: nothing this turn was critical or volatile.

**Artifacts:**
- [S] Tenancy's host lookup reads the `tenant` table before any tenant is known. One option is a `SECURITY DEFINER` function owned by the owner that returns only the tenant id for a host, with the table itself bound like the others. Another is a policy that allows reading by host only — activates when tenancy's policies are written [high] [2026-11-26]

**Next steps:**
- Tenancy: audit its queries (resolve by host, find by id, find by slug, create store), choose how the host lookup reads, add the policy, and test as `market_tenancy`.
