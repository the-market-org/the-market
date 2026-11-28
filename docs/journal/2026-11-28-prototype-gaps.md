# Session log entry — 2026-11-28, what's left for a working prototype

- **What happened:** the owner asked what is left to have the prototype of the system working. All 15 work packages of the master plan are built, and each part was checked on the development database. They aren't yet joined end to end. The agent checked the open pull requests and the three repositories before answering.
- **Found:**
  - 13 pull requests are open: the-market #160 to #162, factory #9 and #10, and commerce-agent #12 to #19.
  - The merchant screen's sign-in form asks for a pasted "Merchant token", so a merchant has no way to sign in through Supabase.
  - The agent service doesn't act on `merchant.message.sent`, although the publisher registers it. An operator runs `build` and `experiment` by hand.
  - The publisher has only the operator route `POST /stores`, and no sign-up page.
  - None of the three repositories has deployment files (Dockerfile, hosting configuration or a deploy workflow) on `main`.
- **Key changes:** none in code.
- **Artifacts:**
  - [I] The prototype's missing links are merchant sign-in through Supabase, the agent answering the merchant's messages, a client sign-up page, and hosting — invalidates as each is built [high] [2026-11-28]
  - [S] A plan for the four missing links, with merchant sign-in first since it touches only the tenant app and Supabase — activates when the owner says to plan them [high] [2026-11-28]
- **Next steps:**
  - The owner merges the 13 pull requests.
  - The owner decides on planning the four links. The open decisions on agent token renewal and the registry's production home come with them.

## Later the same day: is it planned?
- **What happened:** the owner asked whether the plan for the missing links was already written. Every plan on `main` in the three repositories was checked. None plans the four links as tasks.
  - Merchant sign-in and the agent starting with the merchant appear only in the design.
  - The publisher plan defers the sign-up page ("comes later").
  - Nothing mentions hosting.
- **Found:** the superseded 2026-11-15 roadmap's demo ends with "Co-pilot proposes a change from what it observed". The optimiser tests a hypothesis given by an operator, and doesn't yet derive one from the store's telemetry. The master plan's own goal, an outside agent building and optimising through typed, reversible capabilities, is met on the development database.
- **Key changes:** none in code.
- **Artifacts:**
  - [I] "Prototype" can mean three things here: the master plan's goal (met locally), the old six-step demo (one step short, proposals from telemetry), or real clients without an operator (four links short). The owner chooses which to plan for — invalidates once the owner chooses [high] [2026-11-28]
- **Next steps:** the owner chooses the meaning, then a plan for it, with diagrams.

## Later the same day: what hosting involves
- **What happened:** the owner asked what the hosting task is. No plan covers it, so the answer was built from how the three services run today.
- **The services:**
  - The tenant app: Node 22, on the Supabase database with a role per module.
  - The publisher: Node 22, with no database of its own.
  - The agent service: Python 3.13 `serve`, with its registry in a local SQLite file.
- **Tasks found:**
  1. A host for each service, with a lasting disk for the agent's registry, or the registry moved into Supabase.
  2. A domain with an address and HTTPS for every store, because the store is chosen by host name.
  3. Every `.env` value moved into the host's secrets, plus `SECRETS_KEY`, which production requires.
  4. `NODE_ENV=production`, which refuses plain-HTTP event addresses and makes merchant cookies HTTPS-only.
  5. The services' addresses wired to each other, with the publisher and agent service closed beyond their token routes.
  6. Migrations run as the owner role on each release.
  7. Restarts and health checks.
  8. A deploy step on merge to `main`.
- **Key changes:** none in code.
- **Artifacts:**
  - [I] Hosting waits on three owner decisions: the hosting provider, the store domain, and where the registry lives — invalidates once they are decided [high] [2026-11-28]
- **Next steps:** the owner decides those three, then a hosting plan with diagrams.

## Later the same day: hosting on Vercel's free plan
- **What happened:** the owner decided hosting will be Vercel's free (Hobby) plan for the time being. Vercel's documentation was checked on 2026-11-28: the function duration, Hobby plan, function limitations, Python runtime and DNS pages.
- **Confirmed:**
  - A request may run up to 300 seconds, which is the default and the maximum with fluid compute.
  - 1,000,000 invocations, 4 CPU-hours and 360 GB-hours a month. Going over pauses the feature for 30 days.
  - Up to 2 GB of memory, and 50 domains per project.
  - Python ASGI apps run as functions.
  - A wildcard domain's certificate needs Vercel's nameservers, or `_acme-challenge` delegated to Vercel.
- **Not stated in the pages read:** commercial use on Hobby, whether a local file survives between requests, and whether a wildcard counts as one of the 50 domains.
- **Consequences:**
  - The agent service's `serve` becomes a per-request ASGI app. A build of about 40 seconds and building B from an event fit inside 300 seconds.
  - The registry and the waiting experiments move to a `commerce_agent` schema in Supabase, because file persistence isn't documented.
  - The tenant app and the publisher are Node projects.
  - Migrations run from CI or by hand.
- **Artifacts:**
  - [D] Hosting is Vercel's free Hobby plan for the time being, one project per repository — invalidates if the owner moves to a paid plan or another host [critical] [2026-11-28]
  - [D] The agent service's registry and waiting experiments live in Supabase, not local files, because Vercel functions run per request — invalidates if the agent service moves to a host with lasting disks [high] [2026-11-28]
  - [I] Vercel's Hobby pages don't say whether commercial use is allowed. The owner checks Vercel's terms before real merchants sell — invalidates once checked [volatile] [2026-11-28]
- **Next steps:**
  - The owner chooses the store domain and checks Vercel's terms on commercial use.
  - Supabase's connection mode for per-request code is checked in Supabase's docs.
  - Then the hosting plan, with diagrams.
