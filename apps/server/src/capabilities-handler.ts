import type { CapabilityRegistry, HttpReply } from "@the-market/core";

/** Answers GET /api/capabilities with each capability's public fields, sorted by name. Functions are never sent. */
export async function handleListCapabilities(input: { capabilities: CapabilityRegistry }): Promise<HttpReply> {
  const capabilities = Object.values(input.capabilities)
    .map((capability) => ({
      name: capability.name,
      summary: capability.summary,
      inputSchema: capability.inputSchema,
      risk: capability.risk,
    }))
    .sort((first, second) => first.name.localeCompare(second.name));
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    bodyText: JSON.stringify({ capabilities }),
  };
}
