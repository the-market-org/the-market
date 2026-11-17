import assert from "node:assert/strict";
import { test } from "node:test";
import { listInputProblems } from "./capability-input.ts";

const renameSchema = {
  type: "object",
  required: ["productId", "title"],
  properties: { productId: { type: "string" }, title: { type: "string" } },
};

function check(candidate: unknown): string[] {
  return listInputProblems({ inputSchema: renameSchema, candidate });
}

test("valid input has no problems", () => {
  assert.deepEqual(check({ productId: "p1", title: "Lead" }), []);
});

test("a missing required field is named", () => {
  assert.deepEqual(check({ productId: "p1" }), ["Missing field: title"]);
});

test("a field of the wrong type is named with the expected type", () => {
  assert.deepEqual(check({ productId: 7, title: "Lead" }), ["Field productId must be a string"]);
});

test("input that is not an object is refused", () => {
  assert.deepEqual(check("text"), ["Input must be an object"]);
  assert.deepEqual(check(null), ["Input must be an object"]);
  assert.deepEqual(check(["p1", "Lead"]), ["Input must be an object"]);
});

test("every problem is listed, and unknown extra fields are allowed", () => {
  assert.deepEqual(check({ extra: true }), ["Missing field: productId", "Missing field: title"]);
});

test("an optional field may be absent but must have its type when present", () => {
  const schema = { type: "object", properties: { featured: { type: "boolean" }, priceMinor: { type: "number" } } };

  assert.deepEqual(listInputProblems({ inputSchema: schema, candidate: {} }), []);
  assert.deepEqual(listInputProblems({ inputSchema: schema, candidate: { featured: "yes", priceMinor: "9" } }), [
    "Field featured must be a boolean",
    "Field priceMinor must be a number",
  ]);
});
