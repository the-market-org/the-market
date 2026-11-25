import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SECTIONS } from "./default-sections.ts";
import { escapeHtml, readSettingText } from "./escape-html.ts";
import { DEFAULT_PAGES } from "./render-page.ts";
import type { PageData } from "./section-types.ts";

const pageData: PageData = { storeName: "S", products: [], product: undefined, slots: { "product.below-detail": '<div data-app="app_1"><p>stars</p></div>' } };

function renderSlot(slotName: unknown): string {
  const definition = DEFAULT_SECTIONS.find((candidate) => candidate.sectionType === "app-slot");
  return String(definition?.renderSection({ settings: { slotName }, pageData, escape: escapeHtml, readText: readSettingText }));
}

test("an app slot shows the fragment the server prepared, and nothing for an empty slot", () => {
  assert.equal(renderSlot("product.below-detail"), '<section class="app-slot"><div data-app="app_1"><p>stars</p></div></section>');
  assert.equal(renderSlot("home.below-hero"), "");
  assert.equal(renderSlot(42), "");
});

test("the default pages place a slot after the hero and after the product detail", () => {
  assert.deepEqual(DEFAULT_PAGES.home?.map((section) => [section.sectionType, section.settings.slotName]), [["hero", undefined], ["app-slot", "home.below-hero"], ["product-grid", undefined]]);
  assert.deepEqual(DEFAULT_PAGES.product?.map((section) => [section.sectionType, section.settings.slotName]), [["product-detail", undefined], ["app-slot", "product.below-detail"]]);
});
