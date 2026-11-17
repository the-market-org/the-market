# Work package 4 — Change sets: implementation plan, part 2 (tasks 4 to 7)

**For whoever implements this, human or AI:** read part 1 first (`2026-11-17-wp4-change-sets.md`): it holds the goal, the diagrams, the review focus and tasks 1 to 3, whose interfaces these tasks use. The plan is in two files only to keep each pull request under 200 lines.

**Global constraints:** every rule in section 3 of `2026-11-16-build-plan-master.md` applies.

---

### Task 4: Approve and reject

**Files**
- Create: `apps/server/src/change-sets/decide-workflow.ts`
- Test: `apps/server/src/change-sets/decide-workflow.test.ts`

**Interfaces produced**

```ts
export function approveChangeSet(input: { tenantId: string; changeSetId: string; approvedBy: string; moveSet: MoveChangeSet }): Promise<void>; // draft → approved, stores approvedBy
export function rejectChangeSet(input: { tenantId: string; changeSetId: string; moveSet: MoveChangeSet }): Promise<void>; // draft → rejected
type MoveChangeSet = (input: { tenantId: string; changeSetId: string; fromState: string; toState: string; approvedBy: string; failureReason: string }) => Promise<void>;
```

An empty `approvedBy` rejects with `Approval needs a name` before `moveSet` is called.

- [ ] **Step 1: write the failing tests**: approve calls `moveSet` once with `draft → approved` and the name; empty name rejects and calls nothing; reject calls `moveSet` with `draft → rejected` and empty `approvedBy`.
- [ ] **Step 2: run**, expect failures. **Step 3: implement.** **Step 4: run** checks. **Step 5: commit**; open the pull request.

### Task 5: Apply and revert, all or nothing

**Files**
- Create: `apps/server/src/change-sets/apply-workflow.ts`
- Test: `apps/server/src/change-sets/apply-workflow.test.ts`

**Interfaces produced**

```ts
export function applyChangeSet(input: {
  tenantId: string; changeSetId: string;
  capabilities: CapabilityRegistry;
  findSet: (input: { tenantId: string; changeSetId: string }) => Promise<ChangeSetRecord | undefined>;
  moveSet: MoveChangeSet;
}): Promise<void>;
export function revertChangeSet(input: { /* same fields */ }): Promise<void>;
```

`applyChangeSet`: find the set (`Change set not found`); move `approved → applying` (this is the concurrency guard); apply items in position order. When item `n` rejects, revert items `n-1 … 0` in that order, move `applying → failed` with `failureReason` set to the error's message, and reject with that message. When all succeed, move `applying → applied`.

`revertChangeSet`: find; move `applied → reverting`; revert every item in reverse position order; move `reverting → reverted`. A revert that rejects leaves the state `reverting` and rejects with `Revert stopped at item <position>: <message>` so it is visible and can be retried by hand. (Retrying a stuck revert is not in this package.)

- [ ] **Step 1: write the failing tests** with a fake registry whose capability records every apply and revert call in one array:
  - three items, all succeed: calls are `apply 0, apply 1, apply 2`; moves are `approved→applying`, `applying→applied`.
  - item 1 fails with `Product not found`: calls are `apply 0, apply 1, revert 0`; item 2 is never applied; last move is `applying→failed` with `failureReason: "Product not found"`; the call rejects with `Product not found`.
  - revert of three applied items: calls are `revert 2, revert 1, revert 0`; moves `applied→reverting`, `reverting→reverted`.
  - a set whose `moveSet` to `applying` rejects (already applying) applies nothing.
  - an item whose capability is no longer registered fails like any other item: `Unknown capability: <name>`.
- [ ] **Step 2: run**, expect failures. **Step 3: implement** with small functions: one that applies the items and reports the first failing position, one that reverts a list of positions in reverse.
- [ ] **Step 4: run** checks. **Step 5: commit**; open the pull request.

### Task 6: Merchant token guard

**Files**
- Modify: `apps/server/src/hono-adapter.ts` (add `merchantOnly: boolean` to `Route`; `mountRoutes` takes `checkMerchant: (authorization: string) => boolean`), `apps/server/src/compose.ts`, `apps/server/src/main.ts` (reads `MERCHANT_TOKEN`), existing server tests for the new fields
- Create: `apps/server/src/merchant-token.ts`
- Test: `apps/server/src/merchant-token.test.ts`

**Interfaces produced**

```ts
export function matchesMerchantToken(input: { authorization: string; merchantToken: string }): boolean; // true only for "Bearer <token>" with a non-empty token; compares with crypto.timingSafeEqual on equal-length buffers
```

Behaviour: a `merchantOnly` route answers 401 `{"error":"merchant_token_required"}` when `checkMerchant` is false. `composeServer` takes `merchantToken: string`; when it is empty, `merchantOnly` routes are not mounted at all. Existing routes are `merchantOnly: false`.

- [ ] **Step 1: write the failing tests**: `Bearer s3cret` matches `s3cret`; `Bearer wrong`, `s3cret`, `""` and any header when the token is `""` do not; through `composeServer` with a test-only merchant route: missing header 401, right header 200, empty `merchantToken` 404.
- [ ] **Step 2: run**, expect failures. **Step 3: implement.** **Step 4: run** checks; README: one line under "Start the server" saying `MERCHANT_TOKEN` enables the merchant routes. **Step 5: commit**; open the pull request.

### Task 7: Change set routes

**Files**
- Create: `apps/server/src/change-sets/change-set-handlers.ts`
- Modify: `apps/server/src/compose.ts`
- Test: `apps/server/src/change-sets/change-set-routes.test.ts`

All routes are tenant-scoped and `merchantOnly`. Bodies are JSON; a body that is not valid JSON answers 400 `{"error":"invalid_json"}`.

| Method and path | Body | Calls | Success |
|---|---|---|---|
| `POST /api/change-sets` | `{ "title", "proposedBy" }` | `createChangeSet` | 201, the change set |
| `GET /api/change-sets/:changeSetId` | — | `findChangeSet` | 200, the change set with items |
| `POST /api/change-sets/:changeSetId/items` | `{ "capabilityName", "input" }` | `addChangeToSet` | 201, the item |
| `POST /api/change-sets/:changeSetId/approve` | `{ "approvedBy" }` | `approveChangeSet` | 200, the change set |
| `POST /api/change-sets/:changeSetId/reject` | — | `rejectChangeSet` | 200, the change set |
| `POST /api/change-sets/:changeSetId/apply` | — | `applyChangeSet` | 200, the change set |
| `POST /api/change-sets/:changeSetId/revert` | — | `revertChangeSet` | 200, the change set |

Errors map by message: `Change set not found` → 404; `Unknown capability: …`, `Invalid input: …`, `Approval needs a name` → 400; `Change set is not a draft`, `Change set cannot move from …` → 409; any other → 422 with the message (for example a failed apply). Body: `{"error":"<message>"}`.

**Interface produced**

```ts
export function answerChangeSetError(message: string): HttpReply; // the mapping above, as a lookup table of prefixes
```

- [ ] **Step 1: write the failing tests** through `composeServer` with fake services: create then add an item then approve then apply returns `applied`; the same change set id on another host answers 404; adding an item after approval answers 409; an invalid body answers 400 `invalid_json`; `answerChangeSetError` maps each message above.
- [ ] **Step 2: run**, expect failures. **Step 3: implement.** If the task exceeds 200 lines, split read and create routes from the decision routes, and say so in the description.
- [ ] **Step 4: run** checks; then on the development database with the server running, seed, then with `curl`: create a change set, add `catalog.product.rename` for `rope-lead` to `Braided lead`, approve, apply, see the new title in `GET /api/products`, revert, see `Rope lead` again.
- [ ] **Step 5: commit**; open the pull request.

## Done when

All seven pull requests are merged and the `curl` sequence in task 7 renames a product, shows it, and reverts it, on one tenant only.
