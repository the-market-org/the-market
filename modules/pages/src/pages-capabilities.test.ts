import assert from "node:assert/strict";
import { test } from "node:test";
import { addCapability, collectCapabilities, listDeclaredCapabilities } from "@the-market/core";
import type { PageSection } from "./pages-types.ts";
import { buildSetSectionsCapability } from "./pages-capabilities.ts";
import { pagesModule } from "./index.ts";

function buildFakeServices(saved: Record<string, PageSection[]> = {}) {
  const pages = new Map(Object.entries(saved));
  const writes: string[] = [];
  return {
    pages,
    writes,
    findPage: async (request: { tenantId: string; pageKey: string }) => pages.get(request.pageKey),
    savePage: async (request: { tenantId: string; pageKey: string; sections: PageSection[] }) => {
      writes.push(`save ${request.pageKey}`);
      pages.set(request.pageKey, request.sections);
    },
    removePage: async (request: { tenantId: string; pageKey: string }) => {
      writes.push(`remove ${request.pageKey}`);
      pages.delete(request.pageKey);
    },
  };
}

const hero = { sectionType: "hero", settings: { heading: "Leads for every walk", subheading: "Handmade" } };
const grid = { sectionType: "product-grid", settings: { heading: "Shop" } };

function build(candidate: unknown, services = buildFakeServices()) {
  return buildSetSectionsCapability(services).buildChange({ tenantId: "tenant-a", candidate });
}

test("a valid page builds its change and revert without writing", async () => {
  const services = buildFakeServices({ home: [grid] });

  const item = await build({ pageKey: "home", sections: [hero, grid] }, services);

  assert.equal(item.summary, "Set 2 sections on the home page");
  assert.deepEqual(item.change, { pageKey: "home", sections: [hero, grid] });
  assert.deepEqual(item.revert, { pageKey: "home", sections: [grid] });
  assert.deepEqual(services.writes, []);
});

test("apply then revert restores the previous sections", async () => {
  const services = buildFakeServices({ home: [grid] });
  const capability = buildSetSectionsCapability(services);
  const item = await capability.buildChange({ tenantId: "tenant-a", candidate: { pageKey: "home", sections: [hero] } });

  await capability.applyChange({ tenantId: "tenant-a", change: item.change });
  assert.deepEqual(services.pages.get("home"), [hero]);
  await capability.revertChange({ tenantId: "tenant-a", revert: item.revert });
  assert.deepEqual(services.pages.get("home"), [grid]);
});

test("reverting a first-ever page removes it, so the defaults show again", async () => {
  const services = buildFakeServices();
  const capability = buildSetSectionsCapability(services);
  const item = await capability.buildChange({ tenantId: "tenant-a", candidate: { pageKey: "home", sections: [hero] } });

  assert.deepEqual(item.revert, { pageKey: "home", remove: true });
  await capability.applyChange({ tenantId: "tenant-a", change: item.change });
  await capability.revertChange({ tenantId: "tenant-a", revert: item.revert });
  assert.deepEqual([services.pages.has("home"), services.writes], [false, ["save home", "remove home"]]);
});

test("the pages module declares the capability", () => {
  const capabilities = collectCapabilities({ definitions: [pagesModule], registry: { pages: buildFakeServices() }, listDeclared: listDeclaredCapabilities, addOne: addCapability });
  assert.deepEqual(Object.keys(capabilities), ["pages.page.set-sections"]);
  assert.equal(capabilities["pages.page.set-sections"]?.risk, "low");
});

test("the input schema describes each theme section: its type, its settings and its pages", () => {
  const schema = buildSetSectionsCapability(buildFakeServices()).inputSchema as {
    properties: { pageKey: { enum: string[] }; sections: { items: { anyOf: Array<{ description: string; required: string[]; properties: { sectionType: { const: string }; settings: { properties: Record<string, unknown> } } }> } } };
  };
  const shapes = schema.properties.sections.items.anyOf;
  const hero = shapes.find((shape) => shape.properties.sectionType.const === "hero");
  assert.deepEqual(schema.properties.pageKey.enum, ["home", "product"]);
  assert.deepEqual(shapes.map((shape) => shape.properties.sectionType.const), ["app-slot", "hero", "rich-text", "product-grid", "product-detail"]);
  assert.deepEqual(hero?.required, ["sectionType", "settings"]);
  assert.deepEqual(Object.keys(hero?.properties.settings.properties ?? {}), ["heading", "subheading"]);
  assert.equal(hero?.description, "Allowed on: home");
});

test("the store's own input check still reads only the top-level fields", async () => {
  const capability = buildSetSectionsCapability(buildFakeServices());
  const built = await capability.buildChange({ tenantId: "tenant-a", candidate: { pageKey: "home", sections: [{ sectionType: "hero", settings: { heading: "Hello" } }] } });
  assert.equal(built.summary, "Set 1 sections on the home page");
  await assert.rejects(capability.buildChange({ tenantId: "tenant-a", candidate: { pageKey: "home", sections: [{ type: "hero" }] } }), /Missing field: sectionType/);
});
