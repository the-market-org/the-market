import assert from "node:assert/strict";
import { test } from "node:test";
import { composeA2aServer } from "@the-market/a2a-gateway";
import type { ChangeSetRecord } from "@the-market/module-changes";
import { buildApprovalHandlers, describeTaskState } from "./a2a-handlers.ts";

const changeSets: Record<string, Partial<ChangeSetRecord>> = { set_1: { changeSetId: "set_1", tenantId: "tenant-a", state: "draft" } };

function buildServer(tenantId: string) {
  return composeA2aServer(
    buildApprovalHandlers({ tenantId, findSet: async (keys) => (keys.tenantId === "tenant-a" ? (changeSets[keys.changeSetId] as ChangeSetRecord | undefined) : undefined), describeState: describeTaskState }),
  );
}

async function rpc(input: { tenantId?: string; method: string; params: unknown }) {
  const reply = await buildServer(input.tenantId ?? "tenant-a")(JSON.stringify({ jsonrpc: "2.0", id: 1, method: input.method, params: input.params }));
  return JSON.parse(reply) as { result?: any; error?: { code: number; message: string } };
}

const approvalMessage = { message: { messageId: "msg_1", role: "ROLE_USER", parts: [{ data: { changeSetId: "set_1" } }] } };

test("every change set state maps to a task state", () => {
  assert.deepEqual(
    ["draft", "approved", "applying", "reverting", "applied", "rejected", "failed", "reverted"].map(describeTaskState),
    ["TASK_STATE_INPUT_REQUIRED", "TASK_STATE_WORKING", "TASK_STATE_WORKING", "TASK_STATE_WORKING", "TASK_STATE_COMPLETED", "TASK_STATE_REJECTED", "TASK_STATE_FAILED", "TASK_STATE_CANCELED"],
  );
});

test("sending an approval message returns the change set's task, waiting for the merchant", async () => {
  const reply = await rpc({ method: "SendMessage", params: approvalMessage });
  assert.deepEqual(reply.result.task, { id: "set_1", contextId: "set_1", status: { state: "TASK_STATE_INPUT_REQUIRED" } });
});

test("GetTask follows the change set as the merchant decides", async () => {
  changeSets.set_1 = { ...changeSets.set_1, state: "applied" };
  const reply = await rpc({ method: "GetTask", params: { id: "set_1" } });
  assert.equal(reply.result.status.state, "TASK_STATE_COMPLETED");
  changeSets.set_1 = { ...changeSets.set_1, state: "draft" };
});

test("another store's change set, or a message without one, is task not found", async () => {
  assert.deepEqual((await rpc({ tenantId: "tenant-b", method: "GetTask", params: { id: "set_1" } })).error, { code: -32001, message: "Task not found" });
  const empty = { message: { ...approvalMessage.message, parts: [{ text: "please approve" }] } };
  assert.deepEqual((await rpc({ method: "SendMessage", params: empty })).error, { code: -32001, message: "Task not found" });
});
