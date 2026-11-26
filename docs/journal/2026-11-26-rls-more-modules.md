# Session log entry — 2026-11-26, after work package 14, before row-level security for more modules

**What happened:** Work package 14 is built and its real check passed (#155, CI passes). #148 to #155 are waiting for merge. This branch is built from #149's branch (catalog row-level security, with `scopeToTenant`) to extend the policies to more modules.

**Key changes:**
- No code yet. This branch, `feat/rls-more-modules`, carries #149's commits.
- The loop's one-shot wakeup (`6e3f9e89`, 11:48, `/loop keep going`) starts the work here.
- `_context.md` is unchanged: nothing this turn was critical or volatile.

**Artifacts:**
- [I] Before a module's adapter is wrapped with `scopeToTenant`, each of its queries must name `tenantId` at the top of `where` or `data`. A nested-only tenant filter would be read as no tenant, and the query would see no rows — invalidates when `readQueryTenant` reads nested filters [high] [2026-11-26]

**Next steps:**
- Check the adapters of pages, carts, orders, apps, experiments, changes and connections for top-level `tenantId`. Then wrap them and add their policy migrations, one or two modules per pull request.
