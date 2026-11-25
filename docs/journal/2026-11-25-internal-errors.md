# Session log entry — 2026-11-25, work package 15 task 1: internal errors stay internal

**What happened:** The turn ended after the work package 15 plan (#138) and the closing-state note on its log entry. The loop's next wakeup starts work package 15 task 1 (internal errors stay internal) on this branch, which is built from `main` and depends on no open pull request.

**Key changes:**
- `error-description.ts`:
  - `isInternalError` is true for Prisma client errors, `TypeError`, `ReferenceError`, `RangeError`, `SyntaxError` and anything thrown that is not an `Error`.
  - `describeForCaller` keeps a domain message. For an internal error it gives "Something went wrong (reference <uuid>)" and logs the reference with the stack.
  - `describeErrorSafely` wires in random references and standard error.
- `describeError` (in `item-steps.ts`) is now `describeErrorSafely`, so every caller is covered with no change of its own: the API routes, the cart pages, the MCP tool replies, and the failure reasons stored on change sets.
- "Something went wrong" maps to 500 in the error table.
- The old test expecting a thrown string back as-is was changed, because that is the leak being closed.
- `pnpm test`: 259 pass. Not checked on a real server: the database fault that leaked in work package 10 is fixed, so the route test simulates one.

**Artifacts:**
- [D] The fix went into `describeError`, the one place errors become text, not into `answerSafely` as the plan said, because cart pages, MCP replies and stored failure reasons all bypass `answerSafely` — invalidates never [high] [2026-11-25]
- [I] Every plan from work package 10 to 15 is written. #130 to #138 here and `the-market-org/commerce-agent` #1 are waiting for merge, and building goes on in parallel where no open pull request is needed — invalidates when they merge [medium] [2026-11-25]

**Context table checked:**
- This entry has no critical or volatile artifact, so `_context.md` is unchanged here.
- The two critical repository decisions (the publisher in `factory`, the agent service in `commerce-agent`) were missing from `main`'s `_context.md`, so this branch adds them too. #132 adds the same rows, and whichever merges second keeps one copy of each.
- The only scheduled job is the loop's one-shot wakeup (`ff10d630`, 22:18), which continues this work.

**Next steps:**
- Work package 15 task 2: `Secure` cookies outside development.
