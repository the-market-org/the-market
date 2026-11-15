import type { HttpReply } from "@the-market/core";

/** Answers GET /health with the loaded module names and the process uptime. */
export async function handleHealth(input: {
  moduleNames: string[];
  readUptime: () => number;
}): Promise<HttpReply> {
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    bodyText: JSON.stringify({
      status: "ok",
      modules: input.moduleNames,
      uptimeSeconds: Math.round(input.readUptime()),
    }),
  };
}
