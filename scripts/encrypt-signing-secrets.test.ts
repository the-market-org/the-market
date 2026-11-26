import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { isSealed, openSecret, sealSecret } from "../modules/connections/src/secret-box.ts";
import { planSealing } from "./encrypt-signing-secrets.ts";

test("only plain secrets are sealed, so a second run changes nothing, and each opens to its old value", () => {
  const key = randomBytes(32);
  const seal = (plain: string) => sealSecret({ plain, key });
  const rows = [{ tenantId: "tenant-a", signingSecret: "old-a" }, { tenantId: "tenant-b", signingSecret: seal("already") }];
  const updates = planSealing({ rows, seal, sealed: isSealed });
  assert.deepEqual(updates.map((update) => update.tenantId), ["tenant-a"]);
  assert.equal(openSecret({ stored: String(updates[0]?.signingSecret), key }), "old-a");
  assert.deepEqual(planSealing({ rows: [{ tenantId: "tenant-a", signingSecret: String(updates[0]?.signingSecret) }, rows[1] as { tenantId: string; signingSecret: string }], seal, sealed: isSealed }), []);
});
