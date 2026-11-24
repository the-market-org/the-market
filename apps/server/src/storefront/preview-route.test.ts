import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "../compose.ts";
import { findPreviewSections } from "./preview-handler.ts";

const heroItem = (heading: string) => ({
  itemId: "item",
  position: 0,
  capabilityName: "pages.page.set-sections",
  summary: "",
  change: { pageKey: "home", sections: [{ sectionType: "hero", settings: { heading } }] },
  revert: {},
});

const draft = { changeSetId: "set_1", tenantId: "tenant-a", state: "draft", items: [heroItem("Draft heading")] };

const registry = {
  tenancy: {
    resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" })[request.host],
    findTenant: async () => ({ name: "Shop" }),
  },
  catalog: { listProducts: async () => [{ productId: "p-rope-lead", handle: "rope-lead", title: "Rope lead", priceMinor: 1800, currencyCode: "GBP" }] },
  pages: {
    findPage: async (request: { pageKey: string }) =>
      request.pageKey === "home" ? [{ sectionType: "hero", settings: { heading: "Live heading" } }] : undefined,
  },
  connections: { saveConnection: async () => ({ signingSecret: "" }), findConnection: async () => undefined, removeConnection: async () => {} },
  changes: {
    createChangeSet: async () => draft,
    findChangeSet: async (request: { tenantId: string; changeSetId: string }) => (request.tenantId === draft.tenantId ? draft : undefined),
    addChangeItem: async () => draft.items[0],
    moveChangeSet: async () => {},
  },
};

async function request(input: { path: string; host?: string; authorization?: string }) {
  const app = await composeServer({ readUptime: () => 0, registry, capabilities: {}, merchantToken: "s3cret", identity: { verifyToken: async () => undefined }, identityEnabled: false });
  const response = await app.request(input.path, { headers: { host: input.host ?? "shop-a.example", authorization: input.authorization ?? "Bearer s3cret" } });
  return { status: response.status, html: await response.text() };
}

test("the last set-sections item for a page wins; other pages and capabilities are ignored", () => {
  const items = [heroItem("First"), { ...heroItem("Other"), capabilityName: "catalog.product.rename" }, heroItem("Last")];
  assert.deepEqual(findPreviewSections({ items, pageKey: "home" })?.[0]?.settings, { heading: "Last" });
  assert.equal(findPreviewSections({ items, pageKey: "product" }), undefined);
});

test("preview shows the draft's page while the storefront still shows the live one", async () => {
  const preview = await request({ path: "/api/change-sets/set_1/preview/home" });
  assert.equal(preview.status, 200);
  assert.match(preview.html, /<h1>Draft heading<\/h1>/);

  const live = await request({ path: "/" });
  assert.match(live.html, /<h1>Live heading<\/h1>/);
});

test("a page the change set does not touch previews as it is now", async () => {
  const preview = await request({ path: "/api/change-sets/set_1/preview/product" });
  assert.match(preview.html, /Rope lead/);
});

test("another store's change set is 404, and no merchant access is 401", async () => {
  assert.equal((await request({ path: "/api/change-sets/set_1/preview/home", host: "shop-b.example" })).status, 404);
  assert.equal((await request({ path: "/api/change-sets/set_1/preview/home", authorization: "" })).status, 401);
});
