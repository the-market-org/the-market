# Session log entry — 2026-11-25, work package 11 task 6: the real check

**What happened:** Task 5 went up as #129. Its CI passed, and the routes answered correctly on the development database. This entry was written after #129 was opened, so this turn is logged in its own file, and task 6 starts on this branch, built from #129.

**Key changes:**
- #129: the merchant routes to list, read, decide and adopt experiments. Adopting goes through the change-set apply workflow.
- `scripts/simulate-visitors.ts` (`pnpm simulate-visitors`) simulates visitors. Each has its own cookies and opens the rope lead page. It adds to cart with probability 0.25 when the page shows the marker text and 0.05 when it does not, and pays for a third of carts. Its mulberry32 generator is seeded, so runs repeat. It uses `node:http` so the `Host` header is kept.
- Tests cover the seeded draws, the add rates over 4 000 draws, keeping cookies, and one visitor's calls. `pnpm test`: 260 pass.
- The first full run on the development database was stopped by the owner part-way. No process was left running, but the experiment it had started kept running. The second run's new start was refused (`An experiment is already running on product`), so the run was finished against the running experiment.
- The real run on the development database, work package 11's "Done when":
  - The simulator sent 400 visitors (seed 7), and 197 of them were shown the variant.
  - The experiment's end was moved to the past with one SQL statement, and it was decided.
  - Over both runs it counted add to cart at 6/289 for control against 71/301 for the variant (z 7.7541), and paid checkout at 1/289 against 17/301 (z 3.7433). The decision was `adopt`, "Goal rose".
  - Adopting applied the variant change set, and 6 of 6 new visitors saw the section.
  - Store B (`shop-b.localhost`, created for the check) lists no experiments.
- `pnpm seed` with `STORE_HOST` cannot add a second store: it always uses the slug `demo`, so `tenant.create` fails with P2002. Store B was created directly for this check.

**Artifacts:**
- [S] The development database now holds 3 stopped test experiments and their test change sets from the checks. A cleanup script for check data would keep the merchant lists readable — activates when the merchant screen (work package 14) lists experiments [low] [2026-11-25]

- [E] `pnpm seed` says `STORE_HOST` seeds another host, but its slug is always `demo`, so a second store fails on the unique slug (P2002). Fix: derive the slug from the host — invalidates when the seed is fixed [medium] [2026-11-25]

**Next steps:**
- Merge #125 to #130. Then the work package 12 plan (publisher skeleton). Fix the seed's fixed slug.
