# Session log entry — 2026-11-17, work package 5 task 4: outbox mail

**What happened:** The default mail sender keeps messages in memory per tenant and logs one line each; nothing goes over the network. Stacked on #58.

**Key changes:**
- `outbox-mail.ts`: `buildOutboxMail({ writeLine })` with `sendMail` and `listSent`. The log line is exactly `Mail to <address>: <subject>`.
- An address needs exactly one `@` with text on both sides and no spaces, otherwise `Invalid mail address`.
- Checks: typecheck clean; 102 tests pass, 4 database tests skipped locally. Tests seen failing first.

**Next steps:**
- Work package 5, task 5: owner authoriser.
