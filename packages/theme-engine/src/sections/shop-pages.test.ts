import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SECTIONS } from "./default-sections.ts";
import { escapeHtml, readSettingText } from "./escape-html.ts";
import { renderCartPage, renderOrderPage, wrapDocument } from "./shop-pages.ts";

test("every shop page shares one document shell with an escaped title", () => {
  const html = wrapDocument({ title: "Leads & Co", body: "<p>x</p>", escape: escapeHtml });
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<title>Leads &amp; Co<\/title>/);
  assert.match(html, /<main><p>x<\/p><\/main>/);
});

test("the product detail section has an add-to-cart form for its product", () => {
  const definition = DEFAULT_SECTIONS.find((candidate) => candidate.sectionType === "product-detail");
  const html = String(
    definition?.renderSection({
      settings: {},
      pageData: { storeName: "S", products: [], product: { productId: "p-1", handle: "rope-lead", title: "Rope lead", priceText: "£18.00" } },
      escape: escapeHtml,
      readText: readSettingText,
    }),
  );
  assert.match(html, /<form method="post" action="\/cart\/lines">/);
  assert.match(html, /<input type="hidden" name="productId" value="p-1">/);
  assert.match(html, /<input type="number" name="quantity" value="1" min="1" max="99">/);
});

test("the cart page lists lines and total and offers to pay; an empty cart says so", () => {
  const full = renderCartPage({
    storeName: "S",
    lines: [{ title: "<b>Lead</b>", quantity: 2, lineTotalText: "£36.00" }],
    totalText: "£36.00",
    errorMessage: "",
    escape: escapeHtml,
  });
  assert.match(full, /<li>2 × &lt;b&gt;Lead&lt;\/b&gt; <span>£36.00<\/span><\/li>/);
  assert.match(full, /<p class="total">Total £36.00<\/p>/);
  assert.match(full, /<form method="post" action="\/cart\/checkout"><button>Pay<\/button><\/form>/);
  assert.doesNotMatch(full, /class="error"/);

  const empty = renderCartPage({ storeName: "S", lines: [], totalText: "", errorMessage: "", escape: escapeHtml });
  assert.match(empty, /Your cart is empty/);
  assert.doesNotMatch(empty, /Pay/);
});

test("a checkout error is shown on the cart page, escaped", () => {
  const html = renderCartPage({ storeName: "S", lines: [{ title: "Lead", quantity: 1, lineTotalText: "£18.00" }], totalText: "£18.00", errorMessage: "take payment failed: <declined>", escape: escapeHtml });
  assert.match(html, /<p class="error">take payment failed: &lt;declined&gt;<\/p>/);
});

test("the order page thanks the shopper with the order number and total", () => {
  const html = renderOrderPage({ storeName: "S", orderNumber: 7, totalText: "£43.00", escape: escapeHtml });
  assert.match(html, /<h1>Thank you<\/h1><p>Order 7 is paid: £43.00\.<\/p>/);
});
