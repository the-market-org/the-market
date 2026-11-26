import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "../compose.ts";

function buildShop() {
  const sets = new Map([
    ["set_1", { changeSetId: "set_1", tenantId: "tenant-a", title: "Warmer <b>home</b>", state: "draft", proposedBy: "agent", approvedBy: "", failureReason: "", items: [{ itemId: "i1", position: 0, capabilityName: "pages.page.set-sections", summary: "Set 1 section on the home page <img onerror=x>", change: { pageKey: "home", sections: [{ sectionType: "rich-text", settings: { text: "Hello from the variant" } }] }, revert: {} }] }],
  ]);
  const applied: string[] = [];
  const registry = {
    tenancy: { resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" })[request.host], findTenant: async () => ({ name: "Shop" }) },
    catalog: { listProducts: async () => [] },
    pages: { findPage: async () => undefined },
    connections: { saveConnection: async () => ({ signingSecret: "" }), findConnection: async () => undefined, removeConnection: async () => {} },
    changes: {
      createChangeSet: async () => ({}),
      addChangeItem: async () => ({}),
      listChangeSets: async () => [],
      findChangeSet: async (keys: { tenantId: string; changeSetId: string }) => [sets.get(keys.changeSetId)].find((set) => set?.tenantId === keys.tenantId),
      moveChangeSet: async (move: { changeSetId: string; fromState: string; toState: string }) => {
        const set = sets.get(move.changeSetId);
        if (set?.state !== move.fromState) {
          throw new Error(`Change set cannot move from ${set?.state} to ${move.toState}`);
        }
        set.state = move.toState;
      },
    },
  };
  const capabilities = { "pages.page.set-sections": { name: "pages.page.set-sections", summary: "", inputSchema: {}, risk: "low" as const, buildChange: async () => ({}) as never, applyChange: async (request: { change: unknown }) => void applied.push(JSON.stringify(request.change)), revertChange: async () => undefined } };
  return { registry, capabilities, applied, sets };
}

async function buildBrowser(shop: ReturnType<typeof buildShop>) {
  const app = await composeServer({ readUptime: () => 0, registry: shop.registry, capabilities: shop.capabilities, merchantToken: "shared-dev", identity: { verifyToken: async () => undefined }, identityEnabled: false });
  const signIn = await app.request("/admin/sign-in", { method: "POST", headers: { host: "shop-a.example", origin: "https://shop-a.example", "content-type": "application/x-www-form-urlencoded" }, body: "token=shared-dev" });
  const cookie = String(signIn.headers.get("set-cookie")).split(";")[0];
  return async (input: { method?: string; path: string; host?: string }) => {
    const host = input.host ?? "shop-a.example";
    const response = await app.request(input.path, { method: input.method ?? "GET", headers: { host, cookie, origin: `https://${host}` } });
    return { status: response.status, location: response.headers.get("location"), html: await response.text() };
  };
}

test("a change set page shows its items escaped, a sandboxed preview, and the moves its state allows", async () => {
  const browse = await buildBrowser(buildShop());
  const page = await browse({ path: "/admin/change-sets/set_1" });
  assert.equal(page.status, 200);
  assert.match(page.html, /<h1>Warmer &lt;b&gt;home&lt;\/b&gt;<\/h1>/);
  assert.match(page.html, /<li>Set 1 section on the home page &lt;img onerror=x&gt;<\/li>/);
  assert.match(page.html, /<iframe sandbox src="\/admin\/change-sets\/set_1\/preview\/home" title="Preview of home"><\/iframe>/);
  assert.match(page.html, /action="\/admin\/change-sets\/set_1\/approve"><button>Approve<\/button>.*action="\/admin\/change-sets\/set_1\/reject"/);
  assert.match((await browse({ path: "/admin/change-sets/set_1/preview/home" })).html, /Hello from the variant/);
});

test("approving then applying goes through the workflows; a move the state does not allow shows the refusal", async () => {
  const shop = buildShop();
  const browse = await buildBrowser(shop);
  assert.deepEqual(await browse({ method: "POST", path: "/admin/change-sets/set_1/approve" }).then((reply) => [reply.status, reply.location]), [303, "/admin/change-sets/set_1"]);
  const refused = await browse({ method: "POST", path: "/admin/change-sets/set_1/approve" });
  assert.equal(refused.status, 409);
  assert.match(refused.html, /<p role="alert">Change set cannot move from approved to approved<\/p>/);
  assert.equal((await browse({ method: "POST", path: "/admin/change-sets/set_1/apply" })).status, 303);
  assert.equal(shop.sets.get("set_1")?.state, "applied");
  assert.equal(shop.applied.length, 1);
  assert.match((await browse({ path: "/admin/change-sets/set_1" })).html, /action="\/admin\/change-sets\/set_1\/revert"/);
});

test("another store's change set is not found, even with a valid session for this one", async () => {
  const browse = await buildBrowser(buildShop());
  assert.equal((await browse({ path: "/admin/change-sets/set_missing" })).status, 404);
  assert.equal((await browse({ path: "/admin/change-sets/set_1", host: "shop-b.example" })).status, 404);
});
