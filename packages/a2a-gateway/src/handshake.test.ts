import assert from "node:assert/strict";
import { test } from "node:test";
import type { HttpReply, HttpRequest } from "@the-market/core";
import {
  AGENT_CARD_PATH,
  buildSkillMessage,
  composeA2aClient,
  composeA2aServer,
  selectJsonRpcUrl,
  waitForTask,
} from "./index.ts";
import type { AgentCard, Task } from "./index.ts";

const reviewsCard: AgentCard = {
  name: "Reviews App",
  description: "Collects and summarises product reviews.",
  version: "1.0.0",
  supportedInterfaces: [
    { url: "https://reviews.example/a2a/v1", protocolBinding: "JSONRPC", protocolVersion: "1.0" },
  ],
  capabilities: { streaming: false, pushNotifications: false },
  defaultInputModes: ["application/json"],
  defaultOutputModes: ["application/json"],
  skills: [{ id: "summarise-reviews", name: "Summarise reviews", description: "Summary per product", tags: [] }],
};

/** A fake third-party app: serves its Agent Card and answers JSON-RPC. */
function buildFakeApp() {
  const taskStates = ["TASK_STATE_WORKING", "TASK_STATE_COMPLETED"] as const;
  let pollCount = 0;
  const answerBody = composeA2aServer({
    SendMessage: async (): Promise<{ task: Task }> => ({
      task: { id: "task_1", status: { state: "TASK_STATE_SUBMITTED" } },
    }),
    GetTask: async (): Promise<Task> => {
      const state = taskStates[Math.min(pollCount, 1)] as Task["status"]["state"];
      pollCount += 1;
      return { id: "task_1", status: { state }, artifacts: [{ artifactId: "art_1", parts: [{ text: "4.6 stars" }] }] };
    },
  });
  return async (request: HttpRequest): Promise<HttpReply> => {
    const isCardRequest = request.method === "GET" && request.url.endsWith(AGENT_CARD_PATH);
    const bodyText = isCardRequest ? JSON.stringify(reviewsCard) : await answerBody(request.bodyText);
    return { status: 200, headers: {}, bodyText };
  };
}

test("discovers an app, sends a task and polls it to completion", async () => {
  const client = composeA2aClient(buildFakeApp());

  const card = await client.discoverAgent("https://reviews.example/");
  const endpointUrl = selectJsonRpcUrl(card.supportedInterfaces);
  assert.equal(endpointUrl, "https://reviews.example/a2a/v1");

  const sendResult = (await client.callMethod({
    endpointUrl,
    method: "SendMessage",
    params: buildSkillMessage({ messageId: "msg_1", skillId: "summarise-reviews", skillInput: { productId: "prod_1" } }),
    requestId: "req_1",
    authToken: "test-token",
  })) as { task: Task };
  assert.equal(sendResult.task.status.state, "TASK_STATE_SUBMITTED");

  const settledTask = await waitForTask({
    taskId: sendResult.task.id,
    fetchTask: async (taskId) =>
      (await client.callMethod({
        endpointUrl,
        method: "GetTask",
        params: { id: taskId },
        requestId: "req_2",
        authToken: "test-token",
      })) as Task,
    pauseFor: async () => {},
    intervalMs: 0,
    maxAttempts: 5,
  });
  assert.equal(settledTask.status.state, "TASK_STATE_COMPLETED");
  assert.equal(settledTask.artifacts?.[0]?.parts[0]?.text, "4.6 stars");
});

test("reports unknown methods and malformed bodies as JSON-RPC errors", async () => {
  const answerBody = composeA2aServer({});
  assert.equal(JSON.parse(await answerBody('{"jsonrpc":"2.0","id":7,"method":"Nope","params":{}}')).error.code, -32601);
  assert.equal(JSON.parse(await answerBody("not json")).error.code, -32700);
});

test("rejects an Agent Card that lacks required fields", async () => {
  const client = composeA2aClient(async () => ({ status: 200, headers: {}, bodyText: '{"name":"Broken"}' }));
  await assert.rejects(client.discoverAgent("https://broken.example"), /Agent Card is missing: description/);
});
