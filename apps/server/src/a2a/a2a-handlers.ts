/**
 * A2A approval tasks. An agent asks for a change set to be reviewed; the task id is the
 * change set id and its state follows the change set. The agent can never approve.
 */
import { RPC_ERROR_CODES, buildRpcFailure } from "@the-market/a2a-gateway";
import type { RpcHandlerMap, Task, TaskState } from "@the-market/a2a-gateway";
import type { ChangeSetRecord } from "@the-market/module-changes";

const TASK_STATES: ReadonlyMap<string, TaskState> = new Map([
  ["draft", "TASK_STATE_INPUT_REQUIRED"],
  ["approved", "TASK_STATE_WORKING"],
  ["applying", "TASK_STATE_WORKING"],
  ["reverting", "TASK_STATE_WORKING"],
  ["applied", "TASK_STATE_COMPLETED"],
  ["rejected", "TASK_STATE_REJECTED"],
  ["failed", "TASK_STATE_FAILED"],
  ["reverted", "TASK_STATE_CANCELED"],
]);

/** The A2A task state for a change set state. */
export function describeTaskState(changeSetState: string): TaskState {
  return TASK_STATES.get(changeSetState) ?? "TASK_STATE_FAILED";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** The change set an approval message names in its first data part that has one, or "". */
export function readChangeSetId(params: unknown): string {
  const message = asRecord(asRecord(params).message);
  const parts: unknown[] = Array.isArray(message.parts) ? message.parts : [];
  const changeSetIds = parts.map((part) => asRecord(asRecord(part).data).changeSetId).filter((value) => typeof value === "string");
  return String(changeSetIds[0] ?? "");
}

/** The task id GetTask asks for, or "". */
export function readTaskId(params: unknown): string {
  const taskId = asRecord(params).id;
  return typeof taskId === "string" ? taskId : "";
}

export function buildApprovalHandlers(input: {
  tenantId: string;
  findSet: (keys: { tenantId: string; changeSetId: string }) => Promise<ChangeSetRecord | undefined>;
  describeState: typeof describeTaskState;
}): RpcHandlerMap {
  const findTask = async (changeSetId: string): Promise<Task> => {
    const changeSet = changeSetId === "" ? undefined : await input.findSet({ tenantId: input.tenantId, changeSetId });
    if (changeSet === undefined) {
      throw buildRpcFailure({ code: RPC_ERROR_CODES.taskNotFound, message: "Task not found" });
    }
    return { id: changeSet.changeSetId, contextId: changeSet.changeSetId, status: { state: input.describeState(changeSet.state) } };
  };
  return {
    SendMessage: async (params) => ({ task: await findTask(readChangeSetId(params)) }),
    GetTask: (params) => findTask(readTaskId(params)),
  };
}
