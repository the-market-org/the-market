# Prototype roadmap

Date: 2026-11-15. Status: **proposed, waiting for owner approval.** Nothing in this file has been built.

This is a roadmap at pull-request level. Each PR gets its own detailed plan, with its own diagram, just before it is built.

## The demo this prototype must give

```mermaid
flowchart LR
    S1[Merchant starts the store<br/>with one command] --> S2[Installs the reviews app<br/>by pasting its URL]
    S2 --> S3[Shopper opens a product page<br/>and sees the reviews fragment]
    S3 --> S4[Shopper pays with a<br/>Stripe test card]
    S4 --> S5[Co-pilot proposes a change<br/>from what it observed]
    S5 --> S6[Merchant approves,<br/>storefront updates]
```

If all six steps work on a laptop with no Docker, the prototype is done.

## Order of work

```mermaid
flowchart TB
    subgraph M1[Milestone 1: a store that runs]
        P1[1 CI: typecheck and tests] --> P2[2 Server app and health route]
        P2 --> P3[3 Database layer, schema per module]
        P3 --> P4[4 Catalog persistence and seed data]
        P4 --> P5[5 Default theme: layout, home, product page]
    end
    subgraph M2[Milestone 2: buy something]
        P6[6 Cart module and add-to-cart partial]
        P7[7 Workflow runner with compensation]
        P8[8 Order module and checkout workflow]
        P9[9 Stripe test checkout and webhook]
        P6 --> P7 --> P8 --> P9
    end
    subgraph M3[Milestone 3: apps]
        P10[10 Apps module: install by URL]
        P11[11 Mock reviews app, an A2A server]
        P12[12 Slots on the product page and overrides folder]
        P13[13 Parser-based sanitizer and CSP]
        P10 --> P11 --> P12 --> P13
    end
    subgraph M4[Milestone 4: the co-pilot]
        P14[14 Telemetry capture and metrics]
        P15[15 Proposal store and approve flow]
        P16[16 Co-pilot v0: one real proposal kind]
        P17[17 Minimal admin: products, apps, proposals]
        P14 --> P15 --> P16 --> P17
    end
    M1 --> M2
    M1 --> M3
    M2 --> M4
    M3 --> M4
```

Milestones 2 and 3 do not depend on each other and can be built in either order.

## Pull requests

Every PR is at most 200 changed lines, includes its tests, and passes `pnpm typecheck` and `pnpm test`. A PR that would exceed 200 lines is split before it is opened.

| # | PR | Done when |
|---|---|---|
| 1 | CI workflow | Typecheck and tests run on every PR |
| 2 | `apps/server` with Hono adapter and health route | `pnpm dev` starts and `/health` answers |
| 3 | Database layer | Each module migrates its own schema; a module cannot query another schema |
| 4 | Catalog persistence | Products and variants are stored, listed and seeded |
| 5 | Default theme | Home and product pages render through HTMX partials |
| 6 | Cart module | Add to cart updates the cart partial without a page reload |
| 7 | Workflow runner | A failing step triggers compensation of earlier steps |
| 8 | Order module and checkout workflow | Placing an order creates order lines with price snapshots |
| 9 | Stripe test mode | A test card pays an order; the signed webhook marks it paid |
| 10 | Apps module | Pasting a URL fetches, validates and stores an Agent Card |
| 11 | Mock reviews app | A separate process serves a card and a `render-fragment` skill |
| 12 | Slots and overrides | The reviews fragment appears on the product page; an override replaces a partial |
| 13 | Sanitizer and CSP | Parser-based allowlist replaces the regex sanitizer; CSP header is set |
| 14 | Telemetry | Page views and cart events are stored and aggregated |
| 15 | Proposals | A proposal can be approved, applied and reverted |
| 16 | Co-pilot v0 | The agent creates one evidence-backed proposal from real telemetry |
| 17 | Admin | A merchant can manage products, apps and proposals in the browser |

Several rows will need more than one PR to stay under 200 lines; the per-PR plan says so when it does.

## Decisions needed before PR 1

| Question | Why it matters |
|---|---|
| May a feature branch be pushed so a PR can be opened, or does the owner push? | A GitHub PR cannot exist without its branch on the remote |
| Which model provider for co-pilot v0, and is a rules-only mode required? | Decides PR 16 and whether a key is needed to run the demo |
| Is embedded PGlite acceptable for local development? | This machine has no Docker or PostgreSQL; it decides PR 3 |
| Real Stripe test keys, or a fake gateway for the demo? | PR 9 needs test-mode keys supplied by the owner |
