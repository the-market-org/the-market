import assert from "node:assert/strict";
import { test } from "node:test";
import { isWellFormedId } from "./prisma-catalog-database.ts";

test("only a UUID is a well-formed product id", () => {
  assert.equal(isWellFormedId("6f1c2a9e-3b4d-4c5e-8f70-1a2b3c4d5e6f"), true);
  assert.equal(isWellFormedId("p1"), false);
  assert.equal(isWellFormedId(""), false);
});
