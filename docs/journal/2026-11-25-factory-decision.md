# Session log entry — 2026-11-25, closed code goes to the factory repository

**What happened:** The owner confirmed that the private repository `the-market-org/factory` is where the closed publisher code lives. The work package 12 plan and the context table were updated on #132. At the owner's request, the git and pull request workflow rules were copied into the owner's global instructions file so they apply in every project.

**Key changes:**
- #132:
  - The plan's part B now says the publisher is built in `the-market-org/factory`.
  - `_context.md` has a critical decision row for it, and a critical open row for the CrewAI agent service, whose home is not confirmed.
  - The description was updated through `gh api`.
- The owner's global instructions file gained a "Git and pull request workflow" section, with a backup of the file from before the change kept in the scratchpad:
  - for every project: no pushes to `main`, pull requests of at most 200 lines, no stacking, no `git add -A`, check a pull request's state before pushing, read CI, plans with diagrams, no AI attribution;
  - for the-market repositories only: closed code in `factory`, `gh api` instead of `gh pr edit`, Node 22 setup.

**Artifacts:**
- [D] Owner decision: the closed publisher lives in `the-market-org/factory`, and nothing closed is committed to `the-market` — invalidates when the owner changes it [critical] [2026-11-25]
- [D] Owner decision, which replaced `factory/agent-service/` the same day: the CrewAI agent service (work package 13) lives in its own private repository, `the-market-org/commerce-agent`, checked out at `/Users/rubencamposdeteba/the-market/commerce-agent` (empty apart from a README). This is recorded on #132, in its description, and in the owner's global instructions file — invalidates when the owner moves it [critical] [2026-11-25]

- [D] The owner made the split explicit: `factory` is for the closed publisher only, and `commerce-agent` is for the CrewAI agent service only. A `publisher/` folder inside `factory`, which the owner never asked for, was removed from the records — invalidates when the owner changes it [critical] [2026-11-25]

**Next steps:**
- Work package 12, part A, task 1: platform access.
