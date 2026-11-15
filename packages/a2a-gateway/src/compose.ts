/**
 * Composition root: the one place in this package that wires concrete
 * functions together. Everything else receives its collaborators as parameters.
 */
import type { SendRequest } from "@the-market/core";
import type { AgentCard } from "./a2a-types.ts";
import { buildAgentCardUrl, fetchAgentCard, listMissingFields } from "./agent-card-client.ts";
import { buildRpcRequest, callAgentMethod } from "./json-rpc-client.ts";
import { answerRpcBody, buildRpcError, parseRpcBody, routeRpcRequest, runRpcHandler } from "./task-router.ts";
import type { RpcHandlerMap } from "./task-router.ts";

export interface A2aClient {
  discoverAgent: (baseUrl: string) => Promise<AgentCard>;
  callMethod: (input: {
    endpointUrl: string;
    method: string;
    params: unknown;
    requestId: string;
    authToken: string;
  }) => Promise<unknown>;
}

export function composeA2aClient(sendRequest: SendRequest): A2aClient {
  return {
    discoverAgent: (baseUrl) =>
      fetchAgentCard({ baseUrl, sendRequest, buildCardUrl: buildAgentCardUrl, listMissing: listMissingFields }),
    callMethod: (input) => callAgentMethod({ ...input, sendRequest, buildRequest: buildRpcRequest }),
  };
}

export function composeA2aServer(handlerMap: RpcHandlerMap): (bodyText: string) => Promise<string> {
  return (bodyText) =>
    answerRpcBody({
      bodyText,
      handlerMap,
      parseBody: parseRpcBody,
      routeRequest: routeRpcRequest,
      runHandler: runRpcHandler,
      buildError: buildRpcError,
    });
}
