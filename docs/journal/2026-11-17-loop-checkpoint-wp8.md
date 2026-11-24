# Session log entry — 2026-11-17, checkpoint after work package 8

**What happened:** Work package 8 (example agent) was planned (#90) and built as stacked pull requests #91 to #94. On the real server with the development database, the example agent built the starter home and product pages into one change set, asked for approval over A2A, and, waiting, reported `TASK_STATE_COMPLETED` after the merchant approved and applied; the storefront showed "Welcome to Demo store", and a revert brought the defaults back. No pull request has been merged since #36.

**Key changes:**
- Independent pull requests (target `main`): #37, #39, #40, #54, #55, #63, #64, #76, #90.
- The chain, merged strictly in order: #38, #41 to #53, #56 to #62, #65 to #75, #77 to #89, #91 to #94.

**Artifacts:**
- [I] Work packages 3 to 8 are complete in open pull requests and checked end to end on the development database — invalidates if any is changed in review [high] [2026-11-17]
- [D] The example agent is open source in `apps/example-agent`, not in `agent-service/` — invalidates if the owner wants it closed [medium] [2026-11-17]

**Next steps:**
- Plan work package 9 (cart, orders, checkout with the fake payment gateway), then build it on top of #94.
