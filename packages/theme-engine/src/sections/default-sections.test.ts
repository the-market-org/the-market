import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SECTIONS } from "./default-sections.ts";
import { escapeHtml, readSettingText } from "./escape-html.ts";
import type { PageData } from "./section-types.ts";

const pageData: PageData = {
  storeName: "Demo store",
  products: [
    { productId: "p-lead", handle: "rope-lead", title: "Rope lead", priceText: "£18.00" },
    { productId: "p-evil", handle: "evil", title: "<script>alert(1)</script>", priceText: "£1.00" },
  ],
  product: { productId: "p-lead", handle: "rope-lead", title: "Rope lead", priceText: "£18.00" },
};

function render(sectionType: string, settings: Record<string, unknown>): string {
  const definition = DEFAULT_SECTIONS.find((candidate) => candidate.sectionType === sectionType);
  return definition?.renderSection({ settings, pageData, escape: escapeHtml, readText: readSettingText }) ?? "missing";
}

test("escapeHtml replaces the five special characters", () => {
  assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`), "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
});

test("the hero shows its heading and subheading, escaped", () => {
  assert.equal(render("hero", { heading: "Leads & collars", subheading: "<b>warm</b>" }), '<section class="hero"><h1>Leads &amp; collars</h1><p>&lt;b&gt;warm&lt;/b&gt;</p></section>');
});

test("the product grid links every product with its price, titles escaped", () => {
  const html = render("product-grid", { heading: "Shop" });
  assert.match(html, /<a href="\/products\/rope-lead">Rope lead<\/a> <span>£18.00<\/span>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("product detail shows the current product, and nothing without one", () => {
  assert.match(render("product-detail", {}), /<h1>Rope lead<\/h1><p class="price">£18.00<\/p>/);
  const definition = DEFAULT_SECTIONS.find((candidate) => candidate.sectionType === "product-detail");
  assert.equal(definition?.renderSection({ settings: {}, pageData: { ...pageData, product: undefined }, escape: escapeHtml, readText: readSettingText }), "");
});

test("each section says which pages it may be used on", () => {
  assert.deepEqual(
    DEFAULT_SECTIONS.map((definition) => [definition.sectionType, [...definition.pageKeys]]),
    [["hero", ["home"]], ["rich-text", ["home", "product"]], ["product-grid", ["home"]], ["product-detail", ["product"]]],
  );
});

test("a non-text setting reads as empty text", () => {
  assert.equal(readSettingText(42), "");
  assert.equal(render("rich-text", { text: ["not", "text"] }), '<section class="rich-text"><p></p></section>');
});
