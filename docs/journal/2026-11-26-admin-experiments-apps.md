# Session log entry — 2026-11-26, work package 14 task 4: experiments and apps pages

**What happened:** The change set page went up as #150, and a wording fix as #151; CI passes on both. Finishing #150 turned up two places where the repository named the AI tool, against the owner's rule. Both are fixed in the files. The first commit of #150 still holds the old line in its history, because a force-push to rewrite it was refused by the permission check.

**Key changes:**
- #150: the change set page, with a sandboxed preview and the moves the state allows, as plain forms.
- #151: a log entry on `main` described the owner's instructions file by a path that carries the tool's name. It now says "the owner's global instructions file".
- Task 4 is built on #150's branch ("Includes #150"), because both add to the admin route list.
- `admin/admin-experiments-apps.ts`:
  - `GET /admin/experiments` lists the experiments: name, page, goal metric and state. A decided one also shows its decision, reason, goal counts per arm and z score, all escaped.
  - A running experiment gets a Decide form, and a decided `adopt` or `unclear` one gets an Adopt form. A `discard` offers none.
  - `GET /admin/apps` lists apps with their status. A `pending` app gets Allow and Refuse forms.
  - Decide, adopt and the app decision go through the same services as the API (`decideExperiment`, `adoptExperiment`, `decideApp`). A refusal shows its message and status.
- The home page links to both pages.
- Tests:
  - Escaping, the action each state allows, and the outcome numbers.
  - Deciding too early gives 409; adopting a discard gives 409.
  - Allowing a pending app makes it `active`.
  - Store B sees none of store A's apps or experiments.
  - `pnpm test`: 298 pass.
- Checked on a real server: the experiments page lists the adopted experiment from work package 11 ("adopt: Goal rose · control 6/289, variant 71/301, z 7.75") and three stopped ones. The apps page lists "Review stars, active", and the home page links to both.

**Artifacts:**
- [E] A log entry named the tool, and the attribution check (a case-insensitive search of the diff for AI tool and vendor names) caught it only on the second commit. Fix: run the check on the staged diff before every commit, and describe actors as "the agent" or "the owner" — invalidates never [high] [2026-11-26]
- [S] If the owner wants #150's history clean too: squash-merge it, or allow the force-push so the branch can be rewritten — activates when the owner chooses [medium] [2026-11-26]

**Next steps:**
- Task 5: the conversation (merchant messages as a signed event to the agent).
