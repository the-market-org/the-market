import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SECTIONS } from "./default-sections.ts";
import { escapeHtml, readSettingText } from "./escape-html.ts";
import { DEFAULT_PAGES, formatPrice, renderPage } from "./render-page.ts";
import type { PageData, PageSection } from "./section-types.ts";

const pageData: PageData = {
  storeName: "Leads & Co",
  products: [{ handle: "rope-lead", title: "Rope lead", priceText: "£18.00" }],
  product: undefined,
};

function render(sections: PageSection[]): string {
  return renderPage({ sections, pageData, definitions: DEFAULT_SECTIONS, escape: escapeHtml, readText: readSettingText });
}

test("prices are formatted in the store's currency", () => {
  assert.equal(formatPrice({ priceMinor: 1800, currencyCode: "GBP" }), "£18.00");
  assert.equal(formatPrice({ priceMinor: 905, currencyCode: "EUR" }), "€9.05");
});

test("the default home page is a hero and a product grid", () => {
  assert.deepEqual(DEFAULT_PAGES.home?.map((section) => section.sectionType), ["hero", "product-grid"]);
  assert.deepEqual(DEFAULT_PAGES.product?.map((section) => section.sectionType), ["product-detail"]);
});

test("a page renders as a full document: escaped title, sections in order, no script", () => {
  const html = render([
    { sectionType: "rich-text", settings: { text: "First" } },
    { sectionType: "hero", settings: { heading: "Second" } },
  ]);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<title>Leads &amp; Co<\/title>/);
  assert.ok(html.indexOf("First") < html.indexOf("Second"));
  assert.doesNotMatch(html, /<script/);
});

test("an unknown section type adds nothing", () => {
  assert.equal(render([{ sectionType: "marquee", settings: {} }]), render([]));
});
