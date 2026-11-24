import assert from "node:assert/strict";
import { test } from "node:test";
import { FILE_KEY_PATTERN } from "./socket-types.ts";

test("file keys are short, lowercase names without paths", () => {
  for (const fileKey of ["logo.png", "hero-1.webp", "a"]) {
    assert.equal(FILE_KEY_PATTERN.test(fileKey), true, fileKey);
  }
  for (const fileKey of ["../x", "a/b", ".hidden", "Logo.png", "", "x".repeat(129)]) {
    assert.equal(FILE_KEY_PATTERN.test(fileKey), false, fileKey);
  }
});
