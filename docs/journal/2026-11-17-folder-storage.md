# Session log entry — 2026-11-17, work package 5 task 3: file storage defaults

**What happened:** File storage now has two defaults, a local folder per tenant and an in-memory store, stacked on #57.

**Key changes:**
- `folder-storage.ts`: `<rootFolder>/<tenantId>/<fileKey>` with the content type beside it; `node:fs/promises` functions are passed in.
- `memory-storage.ts`: the same behaviour in memory.
- `file-keys.ts`: both the tenant id and the file key must match `FILE_KEY_PATTERN`, otherwise `Invalid file key`, before any disk access.
- The tests run the same cases against both stores, using a fresh temporary folder: put and get, another tenant sees nothing, `../x`, `a/b`, `.hidden` and a `../tenant-b` tenant are refused with nothing written, delete then get.
- A test caught that the folder store's `getFile` threw synchronously instead of rejecting; it is now async.
- Checks: typecheck clean; 100 tests pass, 4 database tests skipped locally.

**Next steps:**
- Work package 5, tasks 4 and 5: outbox mail, owner authoriser.
