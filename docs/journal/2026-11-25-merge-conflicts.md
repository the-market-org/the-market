# Session log entry — 2026-11-25, merge conflicts on the plan pull requests

**What happened:** The owner reported that #137 conflicted with `main`. The cause was two pull requests editing neighbouring rows of the master plan's table. Fixing it showed two more: #139 added `_context.md` rows that #132 had already merged, and #138 edited the next table row. All three were fixed. While fixing #138, a merge commit was made with conflict markers still in it; that was corrected on the branch before it reached `main`.

**Key changes:**
- #137: rows 12 to 14 were resolved (main's row 12, the branch's rows 13 and 14). It has since merged.
- #139: `main`'s copy of the two repository decision rows was kept, so the branch no longer changes `_context.md`.
- #138: its rows 12 to 14 were matched to #137's, and the commit with conflict markers was corrected. The whole tree was searched for markers and none remain. Its own changes are its three plan files.
- #138 to #141 are all mergeable and CI passes on each.

**Artifacts:**
- [E] Plan pull requests that each edit one row of the master plan's table conflict with each other, because the rows are next to each other. Fix: give every plan pull request the same final rows, or link a plan from its own file only — invalidates never [medium] [2026-11-25]
- [E] Running an edit script on a file still in conflict, then `git commit`, finishes the merge with the markers in it. Fix: after `git merge`, list `git diff --name-only --diff-filter=U` and resolve those files first. Never commit while the list is not empty — invalidates never [high] [2026-11-25]

**Next steps:**
- Work package 15 task 4 (the parser-based sanitizer) on this branch.
