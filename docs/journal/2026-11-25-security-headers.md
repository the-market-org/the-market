# Session log entry — 2026-11-25, work package 15 task 3: content security policy

**What happened:** Task 2 went up as #140, and CI passes. Task 3 adds the security headers in the Hono adapter, the one place every reply is written, so every route, including the unknown-store reply, gets them with no change to any handler.

**Key changes:**
- `security-headers.ts`: `addSecurityHeaders` always adds `x-content-type-options: nosniff`. HTML replies also get `content-security-policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'` and `referrer-policy: same-origin`. A reply's own header value wins.
- `hono-adapter.ts`: `answerWithRoute` takes `addHeaders`, and `mountRoutes` passes `addSecurityHeaders` in, so callers don't change.
- A test checks that no storefront page has an inline `<script>` or `on*=` attribute (home, product, cart, missing product).
- Checked on a real server: the product page has all three headers, and `/api/products` has `nosniff` with no page policy.
- `pnpm test`: 263 pass.
- htmx for the admin pages, served from the store's own origin, is left for work package 14, because there are no admin pages yet.

**Artifacts:**
- [D] The policy allows scripts only from the store's own origin. A theme or app that needs another script source must change this one constant, in review — invalidates when themes get their own policy setting [medium] [2026-11-25]

**Closing state:** #130 to #140 are waiting for merge (#130 has merged since). The loop goes on to task 4.

**Next steps:**
- Task 4: the parser-based sanitizer.
