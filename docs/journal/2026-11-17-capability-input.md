# Session log entry — 2026-11-17, work package 3 task 2: capability input checking

**What happened:** #34 was confirmed merged. The core can now check a capability's candidate input and name each problem by field before a change is worked out.

**Key changes:**
- `packages/core/src/capability-input.ts`: `listInputProblems({ inputSchema, candidate })`, as in the plan. It supports top-level `required` and `properties` with type `string`, `number` or `boolean`, and allows unknown extra fields.
- Problem texts, exact: `Input must be an object`, `Missing field: <field>`, `Field <field> must be a <type>`. Every problem is listed, required fields first.
- `listInputProblems` is the composition; the checking steps are small exported functions passed into `collectInputProblems`, each within two branches.
- `null` and arrays count as "not an object".
- Checks: typecheck clean; 45 tests pass, 2 database tests skipped locally.

**Artifacts:**
- [D] Capability input uses a small schema subset checked in our own code, not a JSON Schema library — invalidates when a capability needs nested objects, arrays or formats [medium] [2026-11-17]

**Next steps:**
- Owner to merge this pull request.
- Then work package 3, task 3: the catalog can find and rename a product.
