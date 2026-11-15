import { RPC_ERROR_CODES } from "./a2a-types.ts";
import type { JsonRpcRequest, JsonRpcResponse } from "./a2a-types.ts";

/** One handler per A2A method name, for example "SendMessage" or "GetTask". */
export type RpcHandler = (params: unknown) => Promise<unknown>;
export type RpcHandlerMap = Record<string, RpcHandler>;

type RequestId = string | number | null;
type BuildError = (input: { requestId: RequestId; code: number; message: string }) => JsonRpcResponse;

export function buildRpcError(input: { requestId: RequestId; code: number; message: string }): JsonRpcResponse {
  return { jsonrpc: "2.0", id: input.requestId, error: { code: input.code, message: input.message } };
}

export function parseRpcBody(bodyText: string): JsonRpcRequest | undefined {
  try {
    return JSON.parse(bodyText) as JsonRpcRequest;
  } catch {
    return undefined;
  }
}

/** Runs a handler and turns a thrown error into a JSON-RPC internal error. */
export async function runRpcHandler(input: {
  requestId: RequestId;
  params: unknown;
  handleMethod: RpcHandler;
  buildError: BuildError;
}): Promise<JsonRpcResponse> {
  try {
    return { jsonrpc: "2.0", id: input.requestId, result: await input.handleMethod(input.params) };
  } catch {
    return input.buildError({
      requestId: input.requestId,
      code: RPC_ERROR_CODES.internalError,
      message: "Internal error",
    });
  }
}

/** Server side of the handshake: route one JSON-RPC request to its handler. */
export async function routeRpcRequest(input: {
  requestId: RequestId;
  method: string;
  params: unknown;
  handlerMap: RpcHandlerMap;
  buildError: BuildError;
  runHandler: typeof runRpcHandler;
}): Promise<JsonRpcResponse> {
  const handleMethod = input.handlerMap[input.method];
  if (handleMethod === undefined) {
    return input.buildError({
      requestId: input.requestId,
      code: RPC_ERROR_CODES.methodNotFound,
      message: "Method not found",
    });
  }
  return input.runHandler({
    requestId: input.requestId,
    params: input.params,
    handleMethod,
    buildError: input.buildError,
  });
}

/** Turns a raw HTTP body into a raw JSON-RPC reply body. */
export async function answerRpcBody(input: {
  bodyText: string;
  handlerMap: RpcHandlerMap;
  parseBody: (bodyText: string) => JsonRpcRequest | undefined;
  routeRequest: typeof routeRpcRequest;
  runHandler: typeof runRpcHandler;
  buildError: BuildError;
}): Promise<string> {
  const rpcRequest = input.parseBody(input.bodyText);
  if (rpcRequest === undefined) {
    return JSON.stringify(
      input.buildError({ requestId: null, code: RPC_ERROR_CODES.parseError, message: "Invalid JSON payload" }),
    );
  }
  const rpcReply = await input.routeRequest({
    requestId: rpcRequest.id,
    method: rpcRequest.method,
    params: rpcRequest.params,
    handlerMap: input.handlerMap,
    buildError: input.buildError,
    runHandler: input.runHandler,
  });
  return JSON.stringify(rpcReply);
}
