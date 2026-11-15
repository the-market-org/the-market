/** Entry point: reads the environment, builds the server and starts listening. */
import { serve } from "@hono/node-server";
import { composeServer } from "./compose.ts";

const port = Number(process.env.PORT ?? 3000);
const app = await composeServer({ readUptime: () => process.uptime() });

serve({ fetch: app.fetch, port }, (address) => {
  console.log(`the-market server listening on http://localhost:${address.port}`);
});
