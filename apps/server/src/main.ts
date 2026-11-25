/** Entry point: reads the environment, builds the server and starts listening. */
import { serve } from "@hono/node-server";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { composeModules } from "./compose-modules.ts";
import { composeSockets } from "./compose-sockets.ts";
import { composeEventDelivery, postWithFetch } from "./events/compose-events.ts";
import { composeServer } from "./compose.ts";

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) {
  throw new Error("DATABASE_URL is not set. Add it to .env in the repository root.");
}
const { registry, capabilities, subscribeEvent } = await composeModules({ databaseUrl });
composeEventDelivery({ registry, subscribeEvent, post: postWithFetch, readNow: Date.now, writeLine: (line) => console.log(line) });
const merchantToken = process.env.MERCHANT_TOKEN ?? "";
const sockets = composeSockets({
  environment: process.env,
  readNow: Date.now,
  writeLine: (line) => console.log(line),
  files: { writeFile, readFile, rm, mkdir },
});
const app = await composeServer({
  readUptime: () => process.uptime(),
  registry,
  capabilities,
  merchantToken,
  identity: sockets.identity,
  identityEnabled: sockets.identityEnabled,
  allowLocalHttp: process.env.NODE_ENV !== "production",
  appAccess: {
    sendRequest: async (request) => {
      const response = await fetch(request.url, { method: request.method, headers: request.headers, redirect: "error", signal: AbortSignal.timeout(5000), ...(request.method === "GET" ? {} : { body: request.bodyText }) });
      return { status: response.status, headers: {}, bodyText: await response.text() };
    },
    lookupAddress: async (host) => (await lookup(host, { all: true }).catch(() => [])).map((entry) => entry.address),
    authoriser: sockets.authoriser,
  },
});

serve({ fetch: app.fetch, port }, (address) => {
  console.log(`the-market server listening on http://localhost:${address.port}`);
});
