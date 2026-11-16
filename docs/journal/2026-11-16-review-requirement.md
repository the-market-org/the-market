# Session log entry — 2026-11-16, pull request #26 still open; required review blocks merges

This entry is its own file so that it does not conflict with the entries pull request #26 appends to `session-log.md`, and so that #26 stays under the 200-line limit.

**What happened:** The owner reported pull request #26 as merged and asked for the task 3 pull request. A check showed #26 still open with "review required" and no reviews, so task 3 was not opened and stays held locally. While checking, a command carried on after reading the open state and began replaying task 3 onto main; this was undone and the held commit confirmed unchanged.

**Key changes:**
- No code changed. Nothing was opened.
- Held commit `1f2e292` (task 3) kept on local branches `feat/server-tenant-resolution` and `held/task-3`.
- The owner was given three ways to unblock merges.

**Artifacts:**
- [E] Pull requests have been reported merged four times while still open (#16, #25 and #26 twice) — fix: read the pull request state from GitHub before building on it, every time [high] [2026-11-16]
- [E] A check of #26's state did not stop the script, so a replay onto main began before the open state was noticed — fix: the state check must end the script when the pull request is not merged; undone with no loss [settled] [2026-11-16]
- [I] Ruleset "Prevent Push" requires 1 approving review on every pull request; the author cannot approve their own, so every pull request needs the owner's bypass, a second reviewer, or a rule change — invalidates if the ruleset changes [critical] [2026-11-16]
- [D] Unblocking options put to the owner: use the bypass in the merge box; add a second reviewer; or set required approvals to 0 while keeping pull requests mandatory. Repository settings are the owner's to change — invalidates once the owner chooses [high] [2026-11-16]
- [E] `session-log.md` on main held three leftover conflict-marker lines from an earlier cherry-pick, around two intact entries — fix: markers removed in a follow-up pull request; search a resolved file for markers before committing it [settled] [2026-11-16]
- [E] The marker fix was first pushed to this entry's pull request after it had already merged, so it never reached main — fix: read a pull request's state before pushing more commits to its branch [settled] [2026-11-16]
- [S] Keep one file per log entry under `docs/journal/`, as this entry does, so parallel pull requests never conflict on the log — activates if the owner agrees [medium] [2026-11-16]

**Next steps:**
- Owner to choose how pull requests get past the required review, and merge #26.
- Then move task 3 onto main and open its pull request, followed by task 4.
