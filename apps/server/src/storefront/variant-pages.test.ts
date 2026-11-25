import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { assignArm } from "@the-market/module-experiments";
import { buildShopRegistry } from "../checkout/shop-fakes.ts";
import { composeServer } from "../compose.ts";

const EXPERIMENT = { experimentId: randomUUID(), variantChangeSetId: "set_variant", trafficPercent: 50, pageKey: "product" };
const VARIANT_SECTIONS = [{ sectionType: "rich-text", settings: { text: "Free UK delivery" } }];
const digest = (text: string) => createHash("sha256").update(text).digest();
const visitorIn = (arm: string) => Array.from({ length: 50 }, () => randomUUID()).find((visitorKey) => assignArm({ ...EXPERIMENT, visitorKey, digest }) === arm) ?? "";

async function buildShop(exposureDelayMs = 0) {
  const exposures: Array<Record<string, string>> = [];
  const registry = {
    ...buildShopRegistry(),
    changes: { findChangeSet: async () => ({ items: [{ itemId: "i1", position: 0, capabilityName: "pages.page.set-sections", summary: "", change: { pageKey: "product", sections: VARIANT_SECTIONS }, revert: {} }] }) },
    experiments: {
      recordEvent: async () => undefined,
      findRunningExperiment: async (query: { tenantId: string; pageKey: string }) => (query.tenantId === "tenant-a" && query.pageKey === "product" ? EXPERIMENT : undefined),
      recordExposure: async (exposure: Record<string, string>) => {
        await new Promise((resolve) => setTimeout(resolve, exposureDelayMs));
        exposures.push(exposure);
        return String(exposure.arm);
      },
    },
  };
  const app = await composeServer({ readUptime: () => 0, registry, capabilities: {}, merchantToken: "", identity: { verifyToken: async () => undefined }, identityEnabled: false });
  const open = async (input: { visitorKey: string; host?: string; path?: string }) => {
    const response = await app.request(input.path ?? "/products/rope-lead", { headers: { host: input.host ?? "shop-a.example", cookie: `visitor_id=${input.visitorKey}` } });
    return response.text();
  };
  return { open, exposures };
}

test("a variant visitor sees the variant on every visit, a control visitor sees the live page, and both are recorded", async () => {
  const shop = await buildShop();
  const variantVisitor = visitorIn("variant");
  const controlVisitor = visitorIn("control");
  assert.match(await shop.open({ visitorKey: variantVisitor }), /Free UK delivery/);
  assert.match(await shop.open({ visitorKey: variantVisitor }), /Free UK delivery/);
  assert.doesNotMatch(await shop.open({ visitorKey: controlVisitor }), /Free UK delivery/);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(shop.exposures.map((exposure) => [exposure.tenantId, exposure.arm]), [["tenant-a", "variant"], ["tenant-a", "variant"], ["tenant-a", "control"]]);
  assert.doesNotMatch(await shop.open({ visitorKey: variantVisitor, path: "/" }), /Free UK delivery/, "the home page is not in the experiment");
});

test("a slow exposure write never delays the page or changes the arm shown, and another store never runs the experiment", async () => {
  const slow = await buildShop(1000);
  const started = Date.now();
  assert.match(await slow.open({ visitorKey: visitorIn("variant") }), /Free UK delivery/, "the page shows the arm that is recorded");
  assert.ok(Date.now() - started < 500, `page took ${Date.now() - started} ms`);
  const shop = await buildShop();
  assert.doesNotMatch(await shop.open({ visitorKey: visitorIn("variant"), host: "shop-b.example" }), /Free UK delivery/);
  assert.equal(shop.exposures.length, 0);
});
