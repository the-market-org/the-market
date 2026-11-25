# Session log entry — 2026-11-25, work package 15 task 5: app addresses checked when connecting

**What happened:** #137 to #142 merged. App requests used `fetch`, which does its own DNS lookup, so an address checked only at install could later resolve to the store's own network (DNS rebinding). App requests now go through Node's `http`/`https` with a lookup that refuses any private address at the moment of connecting. The plan named an `undici` `Agent`; Node's own `lookup` option does the same without a new dependency.

**Key changes:**
- `apps/app-transport.ts`:
  - `checkRequestUrl` allows public https, or local http in development only. IP-literal hosts are checked here, because Node skips `lookup` for them.
  - `buildCheckedLookup` refuses a connection when any resolved address is private (`App address is not public`).
  - `sendAppRequest` refuses redirects and times out after 5 s.
- `main.ts` sends app requests (Agent Cards, A2A slot fragments) through it, in place of `fetch`.
- Tests:
  - A lookup that answers public, then `127.0.0.1`, is refused the second time.
  - One private address among several is refused.
  - URL rules.
  - Against a real local server: development works, a 302 is refused, and production refuses.
  - `pnpm test`: 281 pass.
- Checked on a real server with the example app on port 4200: in development, installing fetched its card through the new sender (201). In production, the install-time check refused it first (400).

**Artifacts:**
- [D] App requests use Node's `http`/`https` `lookup` hook instead of `fetch`, so the address check runs on every connection, with no new dependency — invalidates when `fetch` offers a per-request lookup hook [medium] [2026-11-25]

**Next steps:**
- Task 6: encrypt the agent connections' signing secrets.
