# Session log entry — 2026-11-25, work package 10 task 6a: the example app

**What happened:** An example third-party app now exists to install and bind in the real check of work package 10. It is independent of the open pull requests, so it is its own pull request on `main`.

**Key changes:**
- `apps/example-app`: a tiny A2A server on `node:http`. Its Agent Card offers one skill, `review-stars`, tagged `storefront-slot`, on a JSON-RPC interface at `/a2a`; `SendMessage` answers with a message whose text part is `<p class="stars">★★★★☆ 4.6 from 128 reviews</p>`. Any other path is 404. `pnpm example-app --port 4200`; it listens on 127.0.0.1 only.
- Checks: typecheck clean; 225 tests pass, 9 database tests skipped locally. Tests seen failing first. Started on a real port: the card and the `SendMessage` reply came back as expected.

**Artifacts:**
- [D] The example app listens on 127.0.0.1 only; it is a local test double, not a service to deploy — invalidates never [low] [2026-11-25]

**Next steps:**
- Owner to merge this and #114; then the install routes, the slot capability and slot rendering.
