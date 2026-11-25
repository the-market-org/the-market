import assert from "node:assert/strict";
import { test } from "node:test";
import { LEAD, buildShopRegistry } from "../checkout/shop-fakes.ts";
import { composeServer } from "../compose.ts";

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

async function buildShop(recordEvent: (event: Record<string, string>) => Promise<void>) {
  const registry = { ...buildShopRegistry(), experiments: { recordEvent } };
  const app = await composeServer({ readUptime: () => 0, registry, capabilities: {}, merchantToken: "", identity: { verifyToken: async () => undefined }, identityEnabled: false });
  return async (input: { path: string; method?: string; cookie?: string; host?: string; form?: Record<string, string> }) => {
    const headers = { host: input.host ?? "shop-a.example", cookie: input.cookie ?? "", "content-type": "application/x-www-form-urlencoded" };
    const response = await app.request(input.path, { method: input.method ?? "GET", headers, body: input.form && new URLSearchParams(input.form).toString() });
    return { status: response.status, setCookie: response.headers.get("set-cookie") ?? "", headers: response.headers };
  };
}

test("a first visit gets a visitor cookie, and views, adds and payments are recorded for that visitor", async () => {
  const events: Array<Record<string, string>> = [];
  const browse = await buildShop(async (event) => void events.push(event));
  const first = await browse({ path: "/products/rope-lead" });
  assert.match(first.setCookie, /^visitor_id=[0-9a-f-]{36}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=31536000$/);
  const visitor = first.setCookie.split(";")[0] ?? "";
  assert.equal((await browse({ path: "/", cookie: visitor })).setCookie, "", "a known visitor keeps their cookie");

  const added = await browse({ method: "POST", path: "/cart/lines", cookie: visitor, form: { productId: LEAD, quantity: "1" } });
  const cart = added.setCookie.split(";")[0] ?? "";
  await browse({ method: "POST", path: "/cart/checkout", cookie: `${visitor}; ${cart}` });
  await settle();
  const visitorKey = visitor.split("=")[1];
  assert.deepEqual(
    events.map((event) => [event.tenantId, event.eventName, event.pageKey, event.visitorKey === visitorKey]),
    [["tenant-a", "page_view", "product", true], ["tenant-a", "page_view", "home", true], ["tenant-a", "add_to_cart", "product", true], ["tenant-a", "checkout_paid", "cart", true]],
  );
});

test("a failing event store never breaks a page, and missing pages and unknown visitors record nothing", async () => {
  const events: Array<Record<string, string>> = [];
  const failing = await buildShop(async () => Promise.reject(new Error("database down")));
  assert.equal((await failing({ path: "/products/rope-lead" })).status, 200);
  const browse = await buildShop(async (event) => void events.push(event));
  assert.equal((await browse({ path: "/products/no-such-thing" })).status, 404);
  await browse({ method: "POST", path: "/cart/lines", form: { productId: LEAD, quantity: "1" } });
  await browse({ path: "/", host: "shop-b.example" });
  await settle();
  assert.deepEqual(events.map((event) => event.tenantId), ["tenant-b"], "only shop B's own view, under shop B");
});
