import type { SendRequest } from "@the-market/core";
import { SETTLED_STATES } from "./a2a-types.ts";
import type { JsonRpcRequest, JsonRpcResponse, SendMessageParams, Task } from "./a2a-types.ts";

export const A2A_VERSION = "1.0";

export function buildRpcRequest(input: { requestId: string; method: string; params: unknown }): JsonRpcRequest {
  return { jsonrpc: "2.0", id: input.requestId, method: input.method, params: input.params };
}

/**
 * Builds a SendMessage payload that asks an app to run one skill.
 * The { skillId, input } data part is a the-market convention: A2A itself
 * lets the remote agent decide which skill a message is for.
 */
export function buildSkillMessage(input: {
  messageId: string;
  skillId: string;
  skillInput: unknown;
}): SendMessageParams {
  return {
    message: {
      messageId: input.messageId,
      role: "ROLE_USER",
      parts: [{ data: { skillId: input.skillId, input: input.skillInput }, mediaType: "application/json" }],
    },
    configuration: { returnImmediately: true },
  };
}

/** Step 3 of the handshake: call one A2A method over JSON-RPC 2.0. */
export async function callAgentMethod(input: {
  endpointUrl: string;
  method: string;
  params: unknown;
  requestId: string;
  authToken: string;
  sendRequest: SendRequest;
  buildRequest: (request: { requestId: string; method: string; params: unknown }) => JsonRpcRequest;
}): Promise<unknown> {
  const reply = await input.sendRequest({
    url: input.endpointUrl,
    method: "POST",
    headers: {
      "content-type": "application/json",
      "a2a-version": A2A_VERSION,
      authorization: `Bearer ${input.authToken}`,
    },
    bodyText: JSON.stringify(
      input.buildRequest({ requestId: input.requestId, method: input.method, params: input.params }),
    ),
  });
  const rpcReply = JSON.parse(reply.bodyText) as JsonRpcResponse;
  if (rpcReply.error !== undefined) {
    throw new Error(`A2A ${input.method} failed (${rpcReply.error.code}): ${rpcReply.error.message}`);
  }
  return rpcReply.result;
}

/** Step 4: poll GetTask until the task settles or the attempts run out. */
export async function waitForTask(input: {
  taskId: string;
  fetchTask: (taskId: string) => Promise<Task>;
  pauseFor: (durationMs: number) => Promise<void>;
  intervalMs: number;
  maxAttempts: number;
}): Promise<Task> {
  for (let attempt = 0; attempt < input.maxAttempts; attempt += 1) {
    const task = await input.fetchTask(input.taskId);
    if (SETTLED_STATES.includes(task.status.state)) {
      return task;
    }
    await input.pauseFor(input.intervalMs);
  }
  throw new Error(`Task ${input.taskId} did not settle after ${input.maxAttempts} attempts`);
}
