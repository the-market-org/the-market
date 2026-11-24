import assert from "node:assert/strict";
import { test } from "node:test";
import { listInputProblems } from "@the-market/core";
import { answerChangeSetError, answerSafely, parseJsonBody, readCheckedBody } from "./change-set-http.ts";
import { describeError } from "./item-steps.ts";

test("each known error maps to its status, anything else to 422", () => {
  const statuses = [
    "Change set not found",
    "invalid_json",
    "Unknown capability: x",
    "Invalid input: Missing field: title",
    "Approval needs a name",
    "Change set is not a draft",
    "Change set cannot move from draft to applied",
    "Product not found",
  ].map((message) => answerChangeSetError(message).status);
  assert.deepEqual(statuses, [404, 400, 400, 400, 400, 409, 409, 422]);
  assert.equal(answerChangeSetError("Product not found").bodyText, '{"error":"Product not found"}');
});

test("an empty body is an empty object; broken JSON is invalid_json", () => {
  assert.deepEqual(parseJsonBody(""), {});
  assert.throws(() => parseJsonBody("{not json"), { message: "invalid_json" });
});

test("a body is checked against its schema", () => {
  const read = (bodyText: string) =>
    readCheckedBody({
      bodyText,
      inputSchema: { type: "object", required: ["approvedBy"], properties: { approvedBy: { type: "string" } } },
      parse: parseJsonBody,
      listProblems: listInputProblems,
    });
  assert.deepEqual(read('{"approvedBy":"Ruth"}'), { approvedBy: "Ruth" });
  assert.throws(() => read("[]"), { message: "Invalid input: Input must be an object" });
  assert.throws(() => read('{"approvedBy":3}'), { message: "Invalid input: Field approvedBy must be a string" });
});

test("a thrown error becomes its reply", async () => {
  const reply = await answerSafely({
    run: async () => Promise.reject(new Error("Change set is not a draft")),
    answerError: answerChangeSetError,
    describe: describeError,
  });
  assert.deepEqual([reply.status, reply.bodyText], [409, '{"error":"Change set is not a draft"}']);
});
