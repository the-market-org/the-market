import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "../compose.ts";

const NOW_SECONDS = Math.floor(Date.now() / 1000);
const tokenFor = (tenantId: string) => `h.${Buffer.from(JSON.stringify({ exp: NOW_SECONDS + 600, sub: tenantId })).toString("base64url")}.s`;
const STORE_A_TOKEN = tokenFor("tenant-a");

const registry = {
  tenancy: { resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" })[request.host], findTenant: async (request: { tenantId: string }) => ({ name: request.tenantId === "tenant-a" ? "Leads <&> Co" : "Shop B" }) },
  catalog: { listProducts: async () => [] },
  pages: { findPage: async () => undefined },
  changes: { createChangeSet: async () => ({}), findChangeSet: async () => undefined, addChangeItem: async () => ({}), moveChangeSet: async () => {} },
  connections: { saveConnection: async () => ({ signingSecret: "" }), findConnection: async () => undefined, removeConnection: async () => {} },
};

async function buildBrowser() {
  const identities: Record<string, { subject: string; tenantId: string; role: string }> = { [STORE_A_TOKEN]: { subject: "m1", tenantId: "tenant-a", role: "merchant" } };
  const app = await composeServer({ readUptime: () => 0, registry, capabilities: {}, merchantToken: "shared-dev", identity: { verifyToken: async (request) => identities[request.token] }, identityEnabled: true });
  return async (input: { method?: string; path: string; host?: string; cookie?: string; origin?: string; form?: Record<string, string> }) => {
    const host = input.host ?? "shop-a.example";
    const headers: Record<string, string> = { host, cookie: input.cookie ?? "", "content-type": "application/x-www-form-urlencoded", ...(input.origin === undefined ? {} : { origin: input.origin }) };
    const response = await app.request(input.path, { method: input.method ?? "GET", headers, body: input.form && new URLSearchParams(input.form).toString() });
    return { status: response.status, location: response.headers.get("location"), setCookie: response.headers.get("set-cookie") ?? "", html: await response.text() };
  };
}

const sessionOf = (setCookie: string) => setCookie.split(";")[0] ?? "";

test("a merchant signs in with their token and gets a strict, Secure session cookie that lasts as long as the token", async () => {
  const browse = await buildBrowser();
  const signedIn = await browse({ method: "POST", path: "/admin/sign-in", origin: "https://shop-a.example", form: { token: STORE_A_TOKEN } });
  assert.deepEqual([signedIn.status, signedIn.location], [303, "/admin"]);
  assert.match(signedIn.setCookie, /^merchant_session=[^;]+; Path=\/admin; HttpOnly; SameSite=Strict; Secure; Max-Age=(59\d|600)$/);
  const home = await browse({ path: "/admin", cookie: sessionOf(signedIn.setCookie) });
  assert.equal(home.status, 200);
  assert.match(home.html, /<h1>Leads &lt;&amp;&gt; Co<\/h1>/, "the store name is escaped");
  const shared = await browse({ method: "POST", path: "/admin/sign-in", origin: "https://shop-a.example", form: { token: "shared-dev" } });
  assert.match(shared.setCookie, /Max-Age=43200$/, "the shared development token gets 12 hours");
});

test("a wrong token, another store's session, and a missing session are refused", async () => {
  const browse = await buildBrowser();
  assert.equal((await browse({ method: "POST", path: "/admin/sign-in", origin: "https://shop-a.example", form: { token: "wrong" } })).status, 401);
  const storeA = sessionOf((await browse({ method: "POST", path: "/admin/sign-in", origin: "https://shop-a.example", form: { token: STORE_A_TOKEN } })).setCookie);
  assert.deepEqual(await browse({ path: "/admin", host: "shop-b.example", cookie: storeA }).then((page) => [page.status, page.location]), [303, "/admin/sign-in"]);
  assert.deepEqual(await browse({ path: "/admin" }).then((page) => [page.status, page.location]), [303, "/admin/sign-in"]);
});

test("a POST from another origin, or with none, never changes anything", async () => {
  const browse = await buildBrowser();
  const session = sessionOf((await browse({ method: "POST", path: "/admin/sign-in", origin: "https://shop-a.example", form: { token: STORE_A_TOKEN } })).setCookie);
  assert.equal((await browse({ method: "POST", path: "/admin/sign-out", cookie: session, origin: "https://evil.example" })).status, 403);
  assert.equal((await browse({ method: "POST", path: "/admin/sign-out", cookie: session })).status, 403);
  assert.equal((await browse({ method: "POST", path: "/admin/sign-in", origin: "https://evil.example", form: { token: STORE_A_TOKEN } })).status, 401);
  const signedOut = await browse({ method: "POST", path: "/admin/sign-out", cookie: session, origin: "https://shop-a.example" });
  assert.deepEqual([signedOut.status, signedOut.location], [303, "/admin/sign-in"]);
  assert.match(signedOut.setCookie, /^merchant_session=; .*Max-Age=0$/);
});
