# Session log entry — 2026-11-26, work package 14 task 1: the merchant session

**What happened:** #144 and #145 merged. Work package 15 task 7 waits for task 8, which needs the owner's database user, so the loop moved to work package 14. Task 1 adds sign-in to the merchant screen.

**Key changes:**
- `admin/admin-session.ts`:
  - The `merchant_session` cookie is `Path=/admin; HttpOnly; SameSite=Strict`, with `Secure` outside development. Its `Max-Age` is the token's remaining `exp`, or 12 hours for the shared development token.
  - `isOwnOrigin` accepts only the store's own origin.
  - `guardAdminRoutes`: a `POST` from another origin, or with none, gets 403. A request with no good session is sent to sign-in (`GET`) or gets 401 (`POST`).
- `admin/admin-routes.ts`:
  - `GET` and `POST /admin/sign-in`. The token goes into a password field, and sign-in reuses `matchesMerchant`, so only a merchant or owner of this host's store is let in.
  - `POST /admin/sign-out` clears the cookie.
  - `GET /admin` shows the store's name, escaped, for now.
  - The routes are mounted when merchant access is enabled.
- Tests: sign-in with an identity token and with the shared token; a wrong token; store A's cookie on store B; no cookie; a foreign origin, and none, on `POST`; sign-out. `pnpm test`: 292 pass.
- Checked on a real server: the sign-in page answers 200. Signing in with `MERCHANT_TOKEN` answers 303 to `/admin`, the home page shows "Demo store", and the cookie has `Path=/admin`, without `Secure` in development.

**Artifacts:**
- [D] The admin pages reuse `matchesMerchant` for the cookie's token, so the rule for who is a merchant of which store lives in one place for the API and the screen — invalidates never [high] [2026-11-26]

**Next steps:**
- Task 2: `listChangeSets` and the admin home page.
