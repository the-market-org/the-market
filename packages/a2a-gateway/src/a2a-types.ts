/**
 * Subset of the A2A 1.0 data model used by the gateway.
 * Field names follow https://a2a-protocol.org/latest/specification/ ;
 * short names such as `id` are wire names fixed by the protocol.
 */
export interface AgentInterface {
  url: string;
  protocolBinding: string;
  protocolVersion: string;
  tenant?: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
}

export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  extendedAgentCard?: boolean;
}

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  supportedInterfaces: AgentInterface[];
  capabilities: AgentCapabilities;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkill[];
  securitySchemes?: Record<string, unknown>;
  securityRequirements?: unknown[];
}

/** Exactly one of text, url or data is set. */
export interface Part {
  text?: string;
  url?: string;
  data?: unknown;
  mediaType?: string;
}

export interface Message {
  messageId: string;
  role: "ROLE_USER" | "ROLE_AGENT";
  parts: Part[];
  taskId?: string;
  contextId?: string;
}

export type TaskState =
  | "TASK_STATE_SUBMITTED"
  | "TASK_STATE_WORKING"
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_FAILED"
  | "TASK_STATE_CANCELED"
  | "TASK_STATE_INPUT_REQUIRED"
  | "TASK_STATE_REJECTED"
  | "TASK_STATE_AUTH_REQUIRED";

export interface Artifact {
  artifactId: string;
  parts: Part[];
  name?: string;
}

export interface Task {
  id: string;
  contextId?: string;
  status: { state: TaskState; timestamp?: string };
  artifacts?: Artifact[];
}

export interface SendMessageParams {
  message: Message;
  configuration?: { returnImmediately?: boolean; acceptedOutputModes?: string[] };
  metadata?: Record<string, unknown>;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

/** Terminal states plus the two interrupted states: polling stops at any of them. */
export const SETTLED_STATES: readonly TaskState[] = [
  "TASK_STATE_COMPLETED",
  "TASK_STATE_FAILED",
  "TASK_STATE_CANCELED",
  "TASK_STATE_REJECTED",
  "TASK_STATE_INPUT_REQUIRED",
  "TASK_STATE_AUTH_REQUIRED",
];

export const RPC_ERROR_CODES = {
  parseError: -32700,
  methodNotFound: -32601,
  internalError: -32603,
  taskNotFound: -32001,
} as const;
