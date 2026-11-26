# Session log entry — 2026-11-26, row-level security for tenancy: every module is bound

**What happened:** Row-level security for apps, experiments and connections went up as #158 (it includes #157, #156 and #149), and CI passes. Every module except tenancy now binds its role to one tenant. This branch is built from #158's branch for the last module.

**Key changes:**
- This branch carries #158's commits, and `main` (with #155's `--host` fix) is merged in.
- `runWithSettings` (core) sets any named settings at the start of one transaction. `runAsTenant` now uses it.
- Tenancy's adapter:
  - finds by host with `app.host` and by slug with `app.slug`;
  - finds by id with `app.tenant_id`;
  - creates with `app.create_store = yes`, plus `app.host` so the new row is readable for `RETURNING`.
- The migration's policies on `tenant`:
  - `tenant_rows`: by id, for every command;
  - `host_lookup` and `slug_lookup`: for reading only, matching only the named host or slug;
  - `create_store`: for inserting, only with the setting.
  It was applied to the development database.
- Test as `market_tenancy`:
  - The new store is found by host, slug and id.
  - An unknown host finds nothing.
  - With nothing named, no store is visible.
  - Creating without the setting is refused.
  It passed, and so did the owner's tenancy test.
- With all nine modules on their own roles and every table under its policies:
  - The screen check passed: agent, previews, approve, apply, revert, and 5 signed events.
  - The conversation check passed: the message was saved and shown, an empty one was refused, and 1 signed event arrived.
  - A purchase paid, and an unknown host got 404.
  - The logs show no permission or policy errors.
- `_context.md`: the error row "BYPASSRLS, so row-level security does nothing" is resolved and removed. A critical decision row now says every table and adapter is bound.
- `pnpm test`: 308 pass.

**Artifacts:**
- [S] Tenancy's host lookup reads the `tenant` table before any tenant is known. One option is a `SECURITY DEFINER` function owned by the owner that returns only the tenant id for a host, with the table itself bound like the others. Another is a policy that allows reading by host only — activates when tenancy's policies are written [high] [2026-11-26]

**Next steps:**
- Work package 15 is complete once #158 and this pull request merge.
- Left in the plans: work package 13, the commerce agent, in its own repository. It needs the owner's OpenRouter key and model.
