# Session log entry — 2026-11-17, work package 4 task 6: merchant token guard

**What happened:** Merchant routes can now be guarded by one shared token until identity exists (work package 5). Stacked on #48.

**Key changes:**
- `apps/server/src/merchant-token.ts`: `matchesMerchantToken` accepts only `Bearer <token>` with a non-empty token, compared in constant time; `guardMerchantRoutes` wraps routes to answer 401 `{"error":"merchant_token_required"}`, and returns no routes when the token is empty, so they answer 404.
- Differs from the plan: the adapter does not know about merchants. It only passes the `Authorization` header through as `RouteRequest.authorization`; the guard is a route wrapper. This keeps `answerWithRoute` within two branches and Hono out of the guard.
- The server reads `MERCHANT_TOKEN` in task 7, when the first merchant routes exist; the README line moves there too.
- Checks: typecheck clean; 80 tests pass, 4 database tests skipped locally. New tests seen failing first.

**Artifacts:**
- [D] One shared merchant token guards change-set routes until per-merchant identity exists — invalidates when work package 5 adds identity [high] [2026-11-17]

**Next steps:**
- Work package 4, task 7: the change set routes.
