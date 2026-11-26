/**
 * Composition and entry point of the example agent.
 * Usage: AGENT_TOKEN=<agent token> pnpm example-agent --store http://localhost:3000 [--host localhost] [--wait 30]
 */
import { composeA2aClient, selectJsonRpcUrl } from "@the-market/a2a-gateway";
import type { HttpRequest } from "@the-market/core";
import { applyHostName, localEndpoint, readAgentArguments } from "./agent-arguments.ts";
import { buildMcpClient } from "./mcp-client.ts";
import { addPlannedCalls, requireTool, runExampleAgent, waitForDecision } from "./run-agent.ts";
import { buildStarterPlan } from "./starter-plan.ts";

const readOptions = readAgentArguments({ argv: process.argv.slice(2), environment: process.env });
const options = { ...readOptions, storeUrl: applyHostName({ storeUrl: readOptions.storeUrl, hostName: readOptions.hostHeader }) };

async function sendRequest(request: HttpRequest) {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(request.method === "GET" ? {} : { body: request.bodyText }),
  });
  return { status: response.status, headers: {}, bodyText: await response.text() };
}

const a2a = composeA2aClient(sendRequest);
const card = await a2a.discoverAgent(options.storeUrl);
const a2aEndpoint = localEndpoint({ interfaceUrl: selectJsonRpcUrl(card.supportedInterfaces), storeUrl: options.storeUrl });
const mcp = buildMcpClient({
  endpointUrl: new URL("/mcp", options.storeUrl).toString(),
  agentToken: options.agentToken,
  post: (request) => sendRequest({ ...request, method: "POST" }),
});
const callA2a = (method: string, params: unknown) =>
  a2a.callMethod({ endpointUrl: a2aEndpoint, method, params, requestId: `${method}-${Date.now()}`, authToken: options.agentToken }) as Promise<Record<string, any>>;

const outcome = await runExampleAgent({
  storeName: card.name,
  callTool: mcp.callTool,
  listToolNames: async () => ((await mcp.callMethod({ method: "tools/list", params: {} })).tools as Array<{ name: string }>).map((tool) => tool.name),
  askApproval: async ({ changeSetId }) =>
    (await callA2a("SendMessage", { message: { messageId: `approval-${changeSetId}`, role: "ROLE_USER", parts: [{ data: { changeSetId } }] } })).task.status.state,
  readTaskState: async ({ changeSetId }) => (await callA2a("GetTask", { id: changeSetId })).status.state,
  buildPlan: buildStarterPlan,
  requireOffered: requireTool,
  addCalls: addPlannedCalls,
  waitFor: waitForDecision,
  pauseFor: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  waitPolls: options.waitPolls,
  writeLine: (line) => console.log(line),
});
console.log(`Done: change set ${outcome.changeSetId}, ${outcome.finalState}`);
