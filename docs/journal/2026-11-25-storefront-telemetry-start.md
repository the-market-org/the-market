# Session log entry — 2026-11-25, after work package 11 task 3b

**What happened:** Task 3b went up as #126. Its log entry, `2026-11-25-experiment-start-capability.md`, was finished and committed in this turn. The real check left a few test change sets (drafts, an approved variant and a reverted start) in the development database. Nothing from #116 to #126 has merged.

**Key changes:**
- #126: `experiments.start`, checked on the development database.
- This branch, for task 4, starts from #126.

**Artifacts:**
- [E] Nested JSON passed inline to `curl` in check scripts broke on shell quoting twice. Fix: build request bodies with `printf` into a variable first — invalidates never [low] [2026-11-25]

**Next steps:**
- Task 4: the `visitor_id` cookie, the `page_view`, `add_to_cart` and `checkout_paid` events, and variant pages for visitors in the variant arm.
