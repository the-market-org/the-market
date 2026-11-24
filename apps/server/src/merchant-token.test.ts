import assert from "node:assert/strict";
import { test } from "node:test";
import type { Identity } from "@the-market/sockets";
import { Hono } from "hono";
import { answerWithRoute, mountRoutes } from "./hono-adapter.ts";
import type { Route } from "./hono-adapter.ts";
import { guardMerchantRoutes, isMerchantOf, matchesMerchant, matchesMerchantToken, readBearerToken } from "./merchant-token.ts";

test("only the exact shared bearer token matches", () => {
  assert.equal(matchesMerchantToken({ authorization: "Bearer s3cret", merchantToken: "s3cret" }), true);
  assert.equal(matchesMerchantToken({ authorization: "Bearer wrong", merchantToken: "s3cret" }), false);
  assert.equal(matchesMerchantToken({ authorization: "s3cret", merchantToken: "s3cret" }), false);
  assert.equal(matchesMerchantToken({ authorization: "Bearer ", merchantToken: "" }), false);
});

/** Fake identity: the token text names the identity, for example "tenant-a:owner". */
async function verifyFakeToken(request: { token: string }): Promise<Identity | undefined> {
  const [tenantId = "", role = ""] = request.token.split(":");
  return tenantId === "" ? undefined : { subject: "user-1", tenantId, role };
}

const secretRoute: Route = {
  method: "GET",
  path: "/secret",
  tenantScoped: true,
  handleRequest: async () => ({ status: 200, headers: {}, bodyText: "inside" }),
};

function buildApp(input: { merchantToken: string; identityEnabled: boolean }): Hono {
  return mountRoutes({
    app: new Hono(),
    routes: guardMerchantRoutes({
      routes: [secretRoute],
      enabled: input.merchantToken !== "" || input.identityEnabled,
      matches: (request) =>
        matchesMerchant({
          ...request,
          merchantToken: input.merchantToken,
          verifyToken: verifyFakeToken,
          matchesShared: matchesMerchantToken,
          readBearer: readBearerToken,
          isMerchant: isMerchantOf,
        }),
    }),
    answerRoute: answerWithRoute,
    resolveTenant: async (host) => ({ "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" })[host],
  });
}

function requestSecret(app: Hono, input: { host: string; authorization?: string }): Promise<Response> {
  return Promise.resolve(app.request("/secret", { headers: { host: input.host, authorization: input.authorization ?? "" } }));
}

test("the shared token still opens merchant routes", async () => {
  const app = buildApp({ merchantToken: "s3cret", identityEnabled: false });
  assert.equal((await requestSecret(app, { host: "shop-a.example", authorization: "Bearer s3cret" })).status, 200);
  const refused = await requestSecret(app, { host: "shop-a.example" });
  assert.deepEqual([refused.status, await refused.json()], [401, { error: "merchant_token_required" }]);
});

test("an identity token opens only its own store's merchant routes", async () => {
  const app = buildApp({ merchantToken: "", identityEnabled: true });
  assert.equal((await requestSecret(app, { host: "shop-a.example", authorization: "Bearer tenant-a:owner" })).status, 200);
  assert.equal((await requestSecret(app, { host: "shop-a.example", authorization: "Bearer tenant-a:merchant" })).status, 200);
  assert.equal((await requestSecret(app, { host: "shop-b.example", authorization: "Bearer tenant-a:owner" })).status, 401);
  assert.equal((await requestSecret(app, { host: "shop-a.example", authorization: "Bearer tenant-a:shopper" })).status, 401);
  assert.equal((await requestSecret(app, { host: "shop-a.example", authorization: "tenant-a:owner" })).status, 401);
});

test("with neither the shared token nor identity configured, merchant routes do not exist", async () => {
  const app = buildApp({ merchantToken: "", identityEnabled: false });
  assert.equal((await requestSecret(app, { host: "shop-a.example", authorization: "Bearer tenant-a:owner" })).status, 404);
});
