/** Entry point: reads the environment, builds the server and starts listening. */
import { serve } from "@hono/node-server";
import { composeModules } from "./compose-modules.ts";
import { composeServer } from "./compose.ts";

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) {
  throw new Error("DATABASE_URL is not set. Add it to .env in the repository root.");
}
const { registry, capabilities } = await composeModules({ databaseUrl });
const app = await composeServer({ readUptime: () => process.uptime(), registry, capabilities });

serve({ fetch: app.fetch, port }, (address) => {
  console.log(`the-market server listening on http://localhost:${address.port}`);
});
