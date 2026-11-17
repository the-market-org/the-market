import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { answerWithRoute, mountRoutes } from "./hono-adapter.ts";
import type { Route } from "./hono-adapter.ts";
import { guardMerchantRoutes, matchesMerchantToken } from "./merchant-token.ts";

test("only the exact bearer token matches", () => {
  assert.equal(matchesMerchantToken({ authorization: "Bearer s3cret", merchantToken: "s3cret" }), true);
  assert.equal(matchesMerchantToken({ authorization: "Bearer wrong", merchantToken: "s3cret" }), false);
  assert.equal(matchesMerchantToken({ authorization: "s3cret", merchantToken: "s3cret" }), false);
  assert.equal(matchesMerchantToken({ authorization: "", merchantToken: "s3cret" }), false);
  assert.equal(matchesMerchantToken({ authorization: "Bearer ", merchantToken: "" }), false);
});

const secretRoute: Route = {
  method: "GET",
  path: "/secret",
  tenantScoped: false,
  handleRequest: async () => ({ status: 200, headers: {}, bodyText: "inside" }),
};

function buildApp(merchantToken: string): Hono {
  return mountRoutes({
    app: new Hono(),
    routes: guardMerchantRoutes({ routes: [secretRoute], merchantToken, matches: matchesMerchantToken }),
    answerRoute: answerWithRoute,
    resolveTenant: async () => undefined,
  });
}

test("a merchant route needs the token", async () => {
  const app = buildApp("s3cret");

  const refused = await app.request("/secret");
  assert.equal(refused.status, 401);
  assert.deepEqual(await refused.json(), { error: "merchant_token_required" });

  const allowed = await app.request("/secret", { headers: { authorization: "Bearer s3cret" } });
  assert.equal(allowed.status, 200);
  assert.equal(await allowed.text(), "inside");
});

test("without a merchant token, merchant routes do not exist", async () => {
  const response = await buildApp("").request("/secret", { headers: { authorization: "Bearer " } });
  assert.equal(response.status, 404);
});
