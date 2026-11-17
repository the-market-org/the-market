import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOwnerAuthoriser } from "./owner-authoriser.ts";

const ask = { tenantId: "tenant-a", appUrl: "https://reviews.example", permissions: ["read:products"] };

test("an app is pending until the owner decides, and listed while pending", async () => {
  const authoriser = buildOwnerAuthoriser();

  assert.equal(await authoriser.decideApp(ask), "pending");
  assert.deepEqual(authoriser.listPending({ tenantId: "tenant-a" }), [{ appUrl: "https://reviews.example", permissions: ["read:products"] }]);
});

test("an allowed app stays allowed for the permissions decided, and only for its tenant", async () => {
  const authoriser = buildOwnerAuthoriser();
  await authoriser.decideApp(ask);
  authoriser.recordDecision({ tenantId: "tenant-a", appUrl: ask.appUrl, decision: "allowed" });

  assert.equal(await authoriser.decideApp(ask), "allowed");
  assert.deepEqual(authoriser.listPending({ tenantId: "tenant-a" }), []);
  assert.equal(await authoriser.decideApp({ ...ask, permissions: ["read:products", "write:products"] }), "pending");
  assert.equal(await authoriser.decideApp({ ...ask, tenantId: "tenant-b" }), "pending");
});

test("a refused app is refused", async () => {
  const authoriser = buildOwnerAuthoriser();
  await authoriser.decideApp(ask);
  authoriser.recordDecision({ tenantId: "tenant-a", appUrl: ask.appUrl, decision: "refused" });

  assert.equal(await authoriser.decideApp(ask), "refused");
});

test("a decision for an app that never asked allows nothing", async () => {
  const authoriser = buildOwnerAuthoriser();
  authoriser.recordDecision({ tenantId: "tenant-a", appUrl: ask.appUrl, decision: "allowed" });

  assert.equal(await authoriser.decideApp(ask), "pending");
});
