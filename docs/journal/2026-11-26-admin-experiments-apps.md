# Session log entry — 2026-11-26, after work package 14 task 3, before task 4

**What happened:** The change set page went up as #150, and a wording fix as #151; CI passes on both. Finishing #150 turned up two places where the repository named the AI tool, against the owner's rule. Both are fixed in the files. The first commit of #150 still holds the old line in its history, because a force-push to rewrite it was refused by the permission check.

**Key changes:**
- #150: the change set page, with a sandboxed preview and the moves the state allows, as plain forms.
- #151: a log entry on `main` described the owner's instructions file by a path that carries the tool's name. It now says "the owner's global instructions file".
- This branch is built from `main` for task 4 (the experiments and apps pages).
- The loop's one-shot wakeup (`dcc0d600`, 11:09) starts task 4 here.

**Artifacts:**
- [E] A log entry named the tool, and the attribution check (`grep -icE "claude|anthropic|co-authored"`) caught it only on the second commit. Fix: run the check on the staged diff before every commit, and describe actors as "the agent" or "the owner" — invalidates never [high] [2026-11-26]
- [S] If the owner wants #150's history clean too: squash-merge it, or allow the force-push so the branch can be rewritten — activates when the owner chooses [medium] [2026-11-26]

**Next steps:**
- Task 4: `GET /admin/experiments` (counts per arm, outcome numbers, decide and adopt) and `GET /admin/apps` (status; allow or refuse a pending app).
