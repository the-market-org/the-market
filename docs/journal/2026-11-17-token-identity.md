# Session log entry — 2026-11-17, work package 5 task 2: token identity

**What happened:** The default identity socket verifies HS256-signed tokens with `node:crypto`, stacked on #56.

**Key changes:**
- `packages/sockets/src/token-identity.ts`: `buildTokenIdentity({ secret, readNow })`. A token passes only with exactly three parts, header `alg` exactly `HS256`, a configured secret, a matching signature (constant-time compare), a numeric `exp` in the future, a non-empty `sub` and a non-empty `app_metadata.tenant_id`. Role is `app_metadata.role`, default `merchant`.
- `readNow` returns milliseconds, like `Date.now`; `exp` is compared in seconds.
- Tests sign real tokens with `createHmac`, so the verifier is checked against true signatures: wrong secret, expired, non-numeric `exp`, `alg: none`, `HS512`, two or four parts, non-JSON claims, missing tenant, empty subject, empty token, and an empty configured secret are all refused.
- Checks: typecheck clean; 97 tests pass, 4 database tests skipped locally. Tests seen failing first.

**Artifacts:**
- [D] The identity default refuses everything when no secret is configured — invalidates never [high] [2026-11-17]

**Next steps:**
- Work package 5, task 3: folder storage.
