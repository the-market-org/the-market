import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPagesServices, checkPageKey } from "./pages-services.ts";
import type { PageSection, PagesDatabase } from "./pages-types.ts";

function buildFakeDatabase(): PagesDatabase {
  const stored = new Map<string, PageSection[]>();
  const keyOf = (page: { tenantId: string; pageKey: string }) => `${page.tenantId} ${page.pageKey}`;
  return {
    findPage: async (query) => stored.get(keyOf(query)),
    savePage: async (page) => void stored.set(keyOf(page), page.sections),
    removePage: async (query) => void stored.delete(keyOf(query)),
  };
}

type Services = {
  findPage: (input: { tenantId: string; pageKey: string }) => Promise<PageSection[] | undefined>;
  savePage: (input: { tenantId: string; pageKey: string; sections: PageSection[] }) => Promise<void>;
  removePage: (input: { tenantId: string; pageKey: string }) => Promise<void>;
};

function buildServices(): Services {
  return buildPagesServices({ database: buildFakeDatabase(), checkKey: checkPageKey }) as unknown as Services;
}

const hero = { sectionType: "hero", settings: { heading: "Hello" } };

test("a page is saved, found and removed for its own tenant only", async () => {
  const services = buildServices();
  await services.savePage({ tenantId: "tenant-a", pageKey: "home", sections: [hero] });

  assert.deepEqual(await services.findPage({ tenantId: "tenant-a", pageKey: "home" }), [hero]);
  assert.equal(await services.findPage({ tenantId: "tenant-b", pageKey: "home" }), undefined);

  await services.removePage({ tenantId: "tenant-a", pageKey: "home" });
  assert.equal(await services.findPage({ tenantId: "tenant-a", pageKey: "home" }), undefined);
});

test("an unknown page key is refused by every service", async () => {
  const services = buildServices();
  const page = { tenantId: "tenant-a", pageKey: "about" };

  await assert.rejects(services.findPage(page), { message: "Unknown page: about" });
  await assert.rejects(services.savePage({ ...page, sections: [] }), { message: "Unknown page: about" });
  await assert.rejects(services.removePage(page), { message: "Unknown page: about" });
});
