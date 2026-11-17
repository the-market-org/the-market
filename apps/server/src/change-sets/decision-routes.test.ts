import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChangeSetRecord } from "@the-market/module-changes";
import { answerChangeSetError, answerSafely, parseJsonBody, readCheckedBody, replyJson } from "./change-set-http.ts";
import { listInputProblems } from "@the-market/core";
import { buildDecisionRoutes } from "./decision-routes.ts";
import { describeError } from "./item-steps.ts";

/** One stored change set; each decision records its call and moves the state like the real workflows. */
function buildActions() {
  const changeSet = { changeSetId: "set_1", tenantId: "tenant-a", state: "draft", approvedBy: "" } as ChangeSetRecord;
  const calls: string[] = [];
  const keysMatch = (keys: { tenantId: string; changeSetId: string }) => keys.tenantId === changeSet.tenantId && keys.changeSetId === changeSet.changeSetId;
  const decide = (name: string, toState: string) => async (keys: { tenantId: string; changeSetId: string; approvedBy?: string }) => {
    calls.push(`${name} ${keys.approvedBy ?? ""}`.trim());
    Object.assign(changeSet, { state: toState });
  };
  return {
    calls,
    actions: {
      findChangeSet: async (keys: { tenantId: string; changeSetId: string }) => (keysMatch(keys) ? changeSet : undefined),
      approve: decide("approve", "approved"),
      reject: decide("reject", "rejected"),
      apply: decide("apply", "applied"),
      revert: decide("revert", "reverted"),
    },
  };
}

const helpers = {
  readBody: (request: { bodyText: string; inputSchema: Record<string, unknown> }) =>
    readCheckedBody({ ...request, parse: parseJsonBody, listProblems: listInputProblems }),
  reply: replyJson,
  answer: (run: () => Promise<ReturnType<typeof replyJson>>) => answerSafely({ run, answerError: answerChangeSetError, describe: describeError }),
};

function send(input: { routes: ReturnType<typeof buildDecisionRoutes>; path: string; tenantId?: string; bodyText?: string }) {
  const route = input.routes.find((candidate) => candidate.path === input.path);
  return (route as (typeof input.routes)[number]).handleRequest({
    tenantId: input.tenantId ?? "tenant-a",
    pathParams: { changeSetId: "set_1" },
    queryValues: {},
    bodyText: input.bodyText ?? "",
    authorization: "",
  });
}

test("approve, apply and revert each answer the change set in its new state", async () => {
  const { actions, calls } = buildActions();
  const routes = buildDecisionRoutes({ actions, helpers });

  const approved = await send({ routes, path: "/api/change-sets/:changeSetId/approve", bodyText: '{"approvedBy":"Ruth"}' });
  const applied = await send({ routes, path: "/api/change-sets/:changeSetId/apply" });
  const reverted = await send({ routes, path: "/api/change-sets/:changeSetId/revert" });

  assert.deepEqual([approved, applied, reverted].map((reply) => [reply.status, JSON.parse(reply.bodyText).state]), [
    [200, "approved"],
    [200, "applied"],
    [200, "reverted"],
  ]);
  assert.deepEqual(calls, ["approve Ruth", "apply", "revert"]);
});

test("reject answers the rejected change set", async () => {
  const { actions } = buildActions();
  const reply = await send({ routes: buildDecisionRoutes({ actions, helpers }), path: "/api/change-sets/:changeSetId/reject" });
  assert.deepEqual([reply.status, JSON.parse(reply.bodyText).state], [200, "rejected"]);
});

test("approving without a name is refused before anything moves", async () => {
  const { actions, calls } = buildActions();
  const reply = await send({ routes: buildDecisionRoutes({ actions, helpers }), path: "/api/change-sets/:changeSetId/approve" });
  assert.deepEqual([reply.status, reply.bodyText], [400, '{"error":"Invalid input: Missing field: approvedBy"}']);
  assert.deepEqual(calls, []);
});

test("a failed apply answers 422 with its message", async () => {
  const { actions } = buildActions();
  const routes = buildDecisionRoutes({ actions: { ...actions, apply: async () => Promise.reject(new Error("Product not found")) }, helpers });
  const reply = await send({ routes, path: "/api/change-sets/:changeSetId/apply" });
  assert.deepEqual([reply.status, reply.bodyText], [422, '{"error":"Product not found"}']);
});
