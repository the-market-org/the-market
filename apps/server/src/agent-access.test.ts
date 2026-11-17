import assert from "node:assert/strict";
import { test } from "node:test";
import type { Identity } from "@the-market/sockets";
import { Hono } from "hono";
import { guardAgentRoutes, hasAgentRole, matchesAgent } from "./agent-access.ts";
import { answerWithRoute, mountRoutes } from "./hono-adapter.ts";
import type { Route } from "./hono-adapter.ts";
import { readBearerToken } from "./merchant-token.ts";

/** Fake identity: the token text names the identity, for example "tenant-a:agent". */
async function verifyFakeToken(request: { token: string }): Promise<Identity | undefined> {
  const [tenantId = "", role = ""] = request.token.split(":");
  return tenantId === "" ? undefined : { subject: "agent-1", tenantId, role };
}

const echoRoute: Route = {
  method: "POST",
  path: "/agent-only",
  tenantScoped: true,
  handleRequest: async (request) => ({ status: 200, headers: {}, bodyText: request.headerValues["x-probe"] ?? "" }),
};

function buildApp(enabled: boolean): Hono {
  return mountRoutes({
    app: new Hono(),
    routes: guardAgentRoutes({
      routes: [echoRoute],
      enabled,
      matches: (request) => matchesAgent({ ...request, verifyToken: verifyFakeToken, readBearer: readBearerToken, hasRole: hasAgentRole }),
    }),
    answerRoute: answerWithRoute,
    resolveTenant: async (host) => ({ "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" })[host],
  });
}

function call(app: Hono, input: { host: string; token: string }) {
  return Promise.resolve(app.request("/agent-only", { method: "POST", headers: { host: input.host, authorization: `Bearer ${input.token}`, "X-Probe": "seen" } }));
}

test("an agent token opens only its own store's agent routes, and headers reach the handler", async () => {
  const app = buildApp(true);
  const allowed = await call(app, { host: "shop-a.example", token: "tenant-a:agent" });
  assert.deepEqual([allowed.status, await allowed.text()], [200, "seen"]);
  assert.equal((await call(app, { host: "shop-b.example", token: "tenant-a:agent" })).status, 401);
  const owner = await call(app, { host: "shop-a.example", token: "tenant-a:owner" });
  assert.deepEqual([owner.status, await owner.json()], [401, { error: "agent_token_required" }]);
});

test("without identity configured, agent routes do not exist", async () => {
  assert.equal((await call(buildApp(false), { host: "shop-a.example", token: "tenant-a:agent" })).status, 404);
});
