# Phase 2 — System architecture and technical design

Date: 2026-11-15. Status: draft for owner review. Builds on [Phase 1](../research/phase-1-research-and-feasibility.md).

## 1. Intent

the-market is an open-source commerce platform that a small shop can start with one command and a large one can take apart and extend. Three things make it different:

1. **Modules are truly isolated**, each with its own database schema.
2. **Apps are remote agents** that speak the A2A protocol, not code loaded into the server.
3. **A central AI agent** watches store activity and proposes changes the merchant approves.

The open-source core must run self-hosted with no paid service. The commercial offer adds hosting and a better merchant experience on top of the same core.

**Goals:** one-command start; modules replaceable one at a time; apps installable by URL; zero app JavaScript on the storefront; payment gateways as plugins; every default overridable from one folder.

**Non-goals for the MVP:** multi-tenant hosting, marketplaces with many sellers, B2B pricing, a visual theme editor, a graph query engine.

**Anti-goals:** an agent that changes a live store without the merchant's consent; a plugin system that lets third-party code run inside the server process.

## 2. Architecture

```mermaid
flowchart TB
    subgraph Clients
        SF[HTMX storefront]
        AD[Merchant admin]
        EXT[Other frontends<br/>React, Vue, mobile]
    end

    subgraph Edge[HTTP layer, framework independent]
        TE[Theme engine<br/>templates, partials, slots]
        API[JSON API]
    end

    subgraph Core[Core kernel]
        ML[Module loader]
        WF[Workflow runner<br/>sagas with compensation]
        EB[Event bus and outbox]
    end

    subgraph Modules[Domain modules, one schema each]
        CAT[Catalog]
        CART[Cart]
        ORD[Order]
        CUS[Customer]
        PAY[Payment]
        APPS[Apps]
        AGT[Agent]
    end

    subgraph Agentic[Agent layer]
        COP[Co-pilot agent<br/>observe, propose, apply]
        GW[A2A gateway<br/>client and server]
    end

    subgraph Outside[Outside the platform]
        A1[App: reviews]
        A2[App: shipping]
        STR[Stripe]
        PP[PayPal]
        LLM[Model provider]
    end

    DB[(PostgreSQL<br/>schema per module)]

    SF --> TE
    AD --> API
    EXT --> API
    TE --> WF
    API --> WF
    WF --> Modules
    Modules --> EB
    Modules --> DB
    EB --> COP
    COP --> LLM
    COP -->|proposals| AGT
    COP --> GW
    TE -->|slot fragments| GW
    GW <-->|A2A JSON-RPC| A1
    GW <-->|A2A JSON-RPC| A2
    PAY --> STR
    PAY -.-> PP
```

### Request flow

1. A request reaches the theme engine (HTML) or the JSON API. Both are thin: they validate input and call a workflow or a single module service.
2. A workflow runs steps across modules. Each step has a compensation, so a failed checkout releases stock and cancels the payment.
3. A module reads and writes only its own schema and publishes events to the outbox in the same transaction.
4. Events feed read models, the co-pilot agent and the A2A gateway.

### Components

| Component | Responsibility | Skeleton |
|---|---|---|
| Module loader | Orders modules by dependency, registers services, fails fast on missing modules | `packages/core/src/module-loader.ts` |
| Event bus | Publish and subscribe; in memory now, outbox later | `packages/core/src/event-bus.ts` |
| A2A gateway | Fetch Agent Cards, call skills, poll tasks, serve the platform's own card | `packages/a2a-gateway/src/` |
| Theme engine | Render templates and partials, resolve slots, sanitise app fragments | `packages/theme-engine/src/` |
| Payment | Provider contract and registry; Stripe and PayPal adapters | `packages/payment/src/` |
| Co-pilot agent | Turns telemetry into proposals; applies approved ones | Prototype plan |
| Workflow runner | Sagas with compensation | Prototype plan |

## 3. The central agent

```mermaid
flowchart LR
    T[Telemetry and events<br/>page views, carts, orders, stock] --> O[Observe<br/>aggregate into store metrics]
    O --> R[Reason<br/>model plus rules]
    R --> P[Proposal<br/>change, evidence, expected effect]
    P --> G{Autonomy level}
    G -->|suggest| M[Merchant approves or rejects]
    G -->|auto, low risk only| X[Apply]
    M -->|approved| X
    X --> W[Workflow or A2A skill]
    W --> L[Audit log, one-click revert]
    L --> T
```

- **Inputs:** events from modules and anonymous storefront telemetry (no personal data leaves the store by default).
- **Outputs:** proposals, never direct writes. A proposal names the change, the evidence and how to revert it.
- **What it can change:** only what a workflow or an app skill exposes, such as slot bindings, collection order, reorder suggestions and theme settings. It has no database access.
- **Autonomy** is per proposal kind: `suggest` (default), `approve` (one click), `auto` (low-risk kinds the merchant opted into).
- **Model access** sits behind one interface. The first implementation calls OpenRouter; other providers or a rules-only mode can replace it.

## 4. Monorepo layout

```text
the-market/
├── apps/
│   ├── server/              # composition root: loads modules, mounts HTTP adapter
│   └── mock-reviews-app/    # example third-party A2A app for the prototype
├── packages/
│   ├── core/                # module loader, event bus, workflow runner, HTTP port types
│   ├── a2a-gateway/         # Agent Card client, JSON-RPC client and server, task polling
│   ├── theme-engine/        # slots, sanitizer, partial handlers
│   ├── payment/             # provider contract, registry, Stripe and PayPal adapters
│   ├── agent/               # co-pilot: observe, reason, propose
│   └── app-sdk/             # helpers for third parties building A2A apps
├── modules/
│   ├── catalog/             # each module: src/, schema, migrations, tests
│   ├── cart/
│   ├── order/
│   ├── customer/
│   ├── apps/                # app registrations, slot bindings, scopes
│   └── agent/               # agents, tasks, proposals, telemetry
├── themes/
│   └── default/             # layout, pages, partials (HTMX)
├── overrides/               # merchant customisation, wins over every default
├── docs/
│   ├── research/  architecture/  plans/  journal/
└── market.config.ts         # which modules, theme, payment providers and apps are on
```

Folders marked in the table of section 2 exist today. The rest are created by the prototype plan.

### Where customisation lives

Merchants and their developers change behaviour in exactly two places:

| Place | What goes there | How it is resolved |
|---|---|---|
| `market.config.ts` | Which modules, theme and payment providers are enabled; slot order; agent autonomy | Read once at start |
| `overrides/` | Template and partial replacements, extra slots, workflow step replacements | Looked up first: `overrides/` then `themes/<active>/` then the package default |

An override mirrors the path of what it replaces, for example `overrides/themes/default/partials/product-card.ts`. A command lists every active override with the default it shadows, so nothing is hidden.

## 5. Data model

One PostgreSQL database, one schema per module. Ids cross module boundaries as plain columns with no foreign key; relations inside a module use normal foreign keys.

```mermaid
erDiagram
    PRODUCT ||--o{ VARIANT : has
    ORDER ||--o{ ORDER_LINE : contains
    VARIANT ||..o{ ORDER_LINE : "referenced by id"
    APP_REGISTRATION ||--o{ APP_SLOT_BINDING : fills
    AGENT ||--o{ AGENT_TASK : runs
    AGENT ||--o{ AGENT_PROPOSAL : makes
    APP_REGISTRATION ||..o{ AGENT_TASK : "referenced by id"

    PRODUCT { uuid product_id PK
              text handle UK
              text title
              text status }
    VARIANT { uuid variant_id PK
              uuid product_id FK
              text sku UK
              int price_minor
              text currency_code }
    ORDER { uuid order_id PK
            uuid customer_id
            text status
            int total_minor
            text payment_reference }
    ORDER_LINE { uuid line_id PK
                 uuid order_id FK
                 uuid variant_id
                 int quantity
                 int unit_price_minor }
    APP_REGISTRATION { uuid app_id PK
                       text base_url UK
                       jsonb card_json
                       text status }
    APP_SLOT_BINDING { uuid binding_id PK
                       uuid app_id FK
                       text slot_name
                       int priority }
    AGENT { uuid agent_id PK
            text kind
            text autonomy_level }
    AGENT_TASK { uuid task_id PK
                 uuid agent_id FK
                 uuid app_id
                 text state }
    AGENT_PROPOSAL { uuid proposal_id PK
                     uuid agent_id FK
                     text status
                     jsonb change }
```

Solid lines are foreign keys inside one module. Dotted lines are id references across modules.

### Prisma schemas

The owner chose PostgreSQL accessed through Prisma 6.19.3. Each module keeps its own `prisma/schema.prisma`, its own migrations and its own generated client, and connects with `?schema=<module>` so it only sees its own tables. The `schema` connection parameter is documented for Prisma 6; generating one client per module is to be proven in roadmap PR 3.

Model outlines for products, orders, apps and agents are in [data-model-prisma.md](data-model-prisma.md).

## 6. Payments

```mermaid
sequenceDiagram
    autonumber
    participant SF as Storefront
    participant WF as Checkout workflow
    participant PM as Payment module
    participant PR as Provider (Stripe)
    participant OM as Order module

    SF->>WF: Place order
    WF->>OM: Create order, status pending
    WF->>PM: createPayment(order id, amount, idempotency key)
    PM->>PR: Create PaymentIntent, manual capture
    PR-->>PM: Reference and client secret
    PM-->>SF: Client secret
    SF->>PR: Buyer confirms in the browser
    PR->>PM: Webhook, signed
    PM->>PM: parseWebhook verifies signature
    PM->>WF: payment.authorized
    WF->>OM: Mark paid
    WF->>PM: capturePayment
```

- The order and cart modules know only the `PaymentProvider` contract in `packages/payment/src/payment-provider.ts`.
- A provider is one file that implements five functions. Adding a gateway touches no other package.
- Amounts are integers in minor units. Every write carries an idempotency key.
- Card data never touches the server: the buyer confirms with the gateway in the browser.

## 7. Approaches considered

| Decision | Options | Choice and reason |
|---|---|---|
| App integration | In-process plugins; webhooks plus REST; A2A agents | A2A, as the owner specified. It gives discovery, auth and async tasks in one standard. |
| Module isolation | Convention only; schema per module; database per module | Schema per module. Real enforcement without the cost of many databases. |
| ORM | Prisma; Drizzle; raw SQL | Prisma 6.19.3. Owner decision. One Prisma schema per module keeps isolation. |
| HTTP framework | Express; Fastify; Hono | Hono behind a port. Small, and handlers stay framework independent. My call. |
| Templates | A template language; TypeScript functions | TypeScript functions for the MVP. No parser, full type checking. Revisit if theme authors ask. My call. |
| App UI injection | Client scripts; iframes; server-side fragments | Server-side fragments. Only this keeps third-party JavaScript off the storefront. |
| Database | PostgreSQL; embedded PGlite | PostgreSQL everywhere, including local development. Owner decision. |
| Model provider | One vendor SDK; a gateway | OpenRouter first, behind one interface. Owner decision. |
| Payments in the prototype | Real Stripe test mode; fake gateway | Fake gateway first; Stripe keys added by the owner afterwards. Owner decision. |

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Sanitizer bypass in app fragments | Code runs in shoppers' browsers | Parser-based allowlist, strict CSP, htmx eval and script tags off |
| No apps exist for a new protocol | Empty ecosystem at launch | App SDK and first-party apps; installs need only a URL |
| Cross-module reads get slow or stale | Poor listing pages | Read models from events; checkout reads the owner module directly |
| Agent proposes harmful changes | Lost sales, lost trust | Suggest-only default, evidence on every proposal, audit log, one-click revert |
| A2A spec changes again | Rework | Protocol types live in one package; version pinned in a header |

## 9. What the skeletons prove today

`pnpm typecheck` passes and `pnpm test` runs 11 passing tests covering: dependency-ordered module loading, an end-to-end A2A discover, send and poll handshake against a fake app, slot rendering with sanitising, ordering, timeout and failure isolation, and the Stripe adapter including webhook signature checks. Nothing talks to a database, a browser or a real gateway yet.
