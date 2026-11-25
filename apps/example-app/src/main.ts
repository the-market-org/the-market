/** Starts the example app. Usage: pnpm example-app [--port 4200] */
import { createServer } from "node:http";
import { parseArgs } from "node:util";
import { composeA2aServer } from "@the-market/a2a-gateway";
import { answerAppRequest, buildReviewCard, buildReviewHandlers } from "./review-app.ts";

const { values } = parseArgs({ args: process.argv.slice(2), options: { port: { type: "string", default: "4200" } } });
const port = Number(values.port);
const card = buildReviewCard({ baseUrl: `http://localhost:${port}` });
const answerRpc = composeA2aServer(buildReviewHandlers());

createServer((request, response) => {
  let bodyText = "";
  request.on("data", (chunk) => (bodyText += chunk));
  request.on("end", async () => {
    const reply = await answerAppRequest({ method: String(request.method), path: String(request.url).split("?")[0] ?? "", bodyText, card, answerRpc });
    response.writeHead(reply.status, reply.headers).end(reply.bodyText);
  });
}).listen(port, "127.0.0.1", () => console.log(`Example app (review stars) on http://localhost:${port}`));
