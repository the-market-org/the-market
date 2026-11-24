# Session log entry — 2026-11-24, work package 10 task 1: the `apps` module tables

**What happened:** Installed apps and their slot bindings now have their own module and tables, as a pull request on `main`. The adapter follows in its own pull request once this one is merged.

**Key changes:**
- `modules/apps`: schema `apps`, tables `apps` (`base_url` unique per tenant, `name`, `rpc_url`, `slot_skills`, `permissions`, `status` `pending|active|refused`) and `app_slot_bindings` (one binding per tenant, slot and app, with a priority). Migration `20261124000000_init`; the server loads the module; CI migrates it.
- Checks: typecheck clean; 216 tests pass, 8 database tests skipped locally. Migration applied to the development database.

**Artifacts:**
- [I] The development database now has the `apps` schema — invalidates if the database is reset [low] [2026-11-24]

**Next steps:**
- Owner to merge this pull request; then the apps adapter.
