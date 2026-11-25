# Session log entry — 2026-11-25, closed code goes to the factory repository

**What happened:** The owner confirmed that the private repository `the-market-org/factory` is where the closed publisher code lives. The work package 12 plan and the context table were updated on #132. At the owner's request, the git and pull request workflow rules were copied into the global `~/.claude/CLAUDE.md` so they apply in every project.

**Key changes:**
- #132:
  - The plan's part B now says the publisher is built in `the-market-org/factory`.
  - `_context.md` has a critical decision row for it, and a critical open row for the CrewAI agent service, whose home is not confirmed.
  - The description was updated through `gh api`.
- `~/.claude/CLAUDE.md` gained a "Git and pull request workflow" section, with a backup of the file from before the change kept in the scratchpad:
  - for every project: no pushes to `main`, pull requests of at most 200 lines, no stacking, no `git add -A`, check a pull request's state before pushing, read CI, plans with diagrams, no AI attribution;
  - for the-market repositories only: closed code in `factory`, `gh api` instead of `gh pr edit`, Node 22 setup.

**Artifacts:**
- [D] Owner decision: the closed publisher lives in `the-market-org/factory`, and nothing closed is committed to `the-market` — invalidates when the owner changes it [critical] [2026-11-25]
- [D] Owner decision: the CrewAI agent service (work package 13) also lives in `factory` for now, in its own folder `agent-service/`, apart from `publisher/`. This is recorded on #132 and in `~/.claude/CLAUDE.md` — invalidates when the owner moves it [critical] [2026-11-25]

**Next steps:**
- Work package 12, part A, task 1: platform access.
