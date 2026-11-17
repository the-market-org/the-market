# Session log entry — 2026-11-17, work package 3 task 5: `GET /api/capabilities`

**What happened:** Built alongside #37 (task 4), since it touches only the server and the seed script. The server now collects every module's capabilities at start-up and lists them over HTTP.

**Key changes:**
- `composeModules` returns `{ registry, capabilities }`, collecting capabilities with `collectCapabilities`; a name clash now stops start-up.
- `apps/server/src/capabilities-handler.ts`: `handleListCapabilities` answers `{ "capabilities": [{ name, summary, inputSchema, risk }] }` sorted by name; functions are never sent.
- Route `GET /api/capabilities`, not tenant-scoped: it answers for any host.
- `composeServer` gains a `capabilities` input; `main.ts`, `scripts/seed.ts` and the two existing server tests were updated for it.
- Checks: typecheck clean; 49 tests pass, 3 database tests skipped locally. The real server was run with this branch and #37 combined locally (not pushed): `/api/capabilities` listed `catalog.product.rename`.

**Artifacts:**
- [I] Work package 3 is complete once #37 and this pull request merge — invalidates if either is changed in review [high] [2026-11-17]

**Next steps:**
- Owner to merge #37 and this pull request.
- Then write the work package 4 plan (change sets) and start it.
