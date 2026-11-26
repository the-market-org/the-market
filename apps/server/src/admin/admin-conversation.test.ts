import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "../compose.ts";
import { describeListener } from "./admin-conversation.ts";

function buildShop(connection: { eventsUrl: string; eventNames: string[] } | undefined) {
  const messages: Array<{ tenantId: string; messageId: string; text: string; sentAt: string }> = [];
  const registry = {
    tenancy: { resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" })[request.host], findTenant: async () => ({ name: "Shop" }) },
    catalog: { listProducts: async () => [] },
    pages: { findPage: async () => undefined },
    changes: { createChangeSet: async () => ({}), addChangeItem: async () => ({}), listChangeSets: async () => [], findChangeSet: async () => undefined, moveChangeSet: async () => {} },
    connections: {
      saveConnection: async () => ({ signingSecret: "" }),
      removeConnection: async () => {},
      findConnection: async (query: { tenantId: string }) => (query.tenantId === "tenant-a" ? connection : undefined),
      listMessages: async (query: { tenantId: string }) => messages.filter((message) => message.tenantId === query.tenantId).reverse(),
      sendMessage: async (request: { tenantId: string; text: string }) => {
        if (request.text.trim() === "") {
          throw new Error("Invalid input: a message is 1 to 2000 characters");
        }
        messages.push({ tenantId: request.tenantId, messageId: `msg_${messages.length + 1}`, text: request.text.trim(), sentAt: "2026-11-26T11:30:00.000Z" });
      },
    },
  };
  return registry;
}

async function buildBrowser(registry: ReturnType<typeof buildShop>) {
  const app = await composeServer({ readUptime: () => 0, registry, capabilities: {}, merchantToken: "shared-dev", identity: { verifyToken: async () => undefined }, identityEnabled: false });
  const cookieFor = async (host: string) =>
    String((await app.request("/admin/sign-in", { method: "POST", headers: { host, origin: `https://${host}`, "content-type": "application/x-www-form-urlencoded" }, body: "token=shared-dev" })).headers.get("set-cookie")).split(";")[0];
  return async (input: { method?: string; path: string; host?: string; form?: string }) => {
    const host = input.host ?? "shop-a.example";
    const response = await app.request(input.path, { method: input.method ?? "GET", headers: { host, cookie: await cookieFor(host), origin: `https://${host}`, "content-type": "application/x-www-form-urlencoded" }, body: input.form });
    return { status: response.status, location: response.headers.get("location"), html: await response.text() };
  };
}

test("a merchant's message is saved, shown escaped on the home page, and only for that store", async () => {
  const browse = await buildBrowser(buildShop({ eventsUrl: "https://agent.example/events", eventNames: ["merchant.message.sent"] }));
  const sent = await browse({ method: "POST", path: "/admin/messages", form: `text=${encodeURIComponent("make it <b>warmer</b>")}` });
  assert.deepEqual([sent.status, sent.location], [303, "/admin"]);
  const home = await browse({ path: "/admin" });
  assert.match(home.html, /<p>The store&#39;s agent receives these messages\.<\/p>/);
  assert.match(home.html, /<li><time datetime="2026-11-26T11:30:00.000Z">2026-11-26 11:30<\/time> make it &lt;b&gt;warmer&lt;\/b&gt;<\/li>/);
  assert.doesNotMatch((await browse({ path: "/admin", host: "shop-b.example" })).html, /warmer/);
});

test("an empty message shows the refusal, and a store without an agent says messages only wait", async () => {
  const browse = await buildBrowser(buildShop(undefined));
  const refused = await browse({ method: "POST", path: "/admin/messages", form: "text=%20%20" });
  assert.equal(refused.status, 400);
  assert.match(refused.html, /<p role="alert">Invalid input: a message is 1 to 2000 characters<\/p>/);
  assert.match(refused.html, /No agent is connected\. Messages are saved, and the store keeps selling without one\./);
  assert.equal(describeListener({ eventsUrl: "https://agent.example/events", eventNames: ["orders.order.paid"] }), "An agent is connected, but it does not listen for messages.");
});
