import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { answerWithRoute, mountRoutes } from "./hono-adapter.ts";
import type { Route } from "./hono-adapter.ts";

async function resolveFakeTenant(host: string): Promise<string | undefined> {
  return host === "shop-a.example" ? "tenant-a" : undefined;
}

const whoamiRoute: Route = {
  method: "GET",
  path: "/whoami",
  tenantScoped: true,
  handleRequest: async (request) => ({ status: 200, headers: {}, bodyText: request.tenantId }),
};

function buildApp(): Hono {
  return mountRoutes({
    app: new Hono(),
    routes: [whoamiRoute],
    answerRoute: answerWithRoute,
    resolveTenant: resolveFakeTenant,
  });
}

test("a tenant-scoped route receives the tenant of the request's host", async () => {
  const response = await buildApp().request("http://shop-a.example/whoami");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "tenant-a");
});

test("the Host header wins over the URL's host", async () => {
  const response = await buildApp().request("http://localhost/whoami", { headers: { host: "shop-a.example" } });
  assert.equal(await response.text(), "tenant-a");
});

test("an unknown host gets 404 and never reaches the handler", async () => {
  const response = await buildApp().request("http://nobody.example/whoami");
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "unknown_store" });
});
