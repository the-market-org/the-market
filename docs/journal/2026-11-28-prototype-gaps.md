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
