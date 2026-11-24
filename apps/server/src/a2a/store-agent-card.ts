/** Each store's A2A Agent Card (A2A 1.0): where to send tasks, and the one skill it offers. */
import type { AgentCard } from "@the-market/a2a-gateway";

export function buildStoreAgentCard(input: { storeName: string; host: string }): AgentCard {
  return {
    name: input.storeName,
    description: "Store run on the-market. Agents build changes over MCP and ask the merchant to review them here.",
    version: "0.0.0",
    supportedInterfaces: [{ url: `https://${input.host}/a2a`, protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "change-set-approval",
        name: "Change set approval",
        description: "Ask the merchant to review a change set. Send a data part { changeSetId }; the task completes when the change set is applied.",
        tags: ["approval", "change-set"],
      },
    ],
    securitySchemes: { bearer: { httpAuthSecurityScheme: { scheme: "Bearer", bearerFormat: "JWT" } } },
    securityRequirements: [{ schemes: { bearer: { list: [] } } }],
  };
}
