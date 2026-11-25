/** The default theme's sections. Every value from the store passes through `escape`. */
import type { SectionDefinition } from "./section-types.ts";

const textSchema = (fieldNames: string[]) => ({
  type: "object",
  properties: Object.fromEntries(fieldNames.map((fieldName) => [fieldName, { type: "string" }])),
});

export const DEFAULT_SECTIONS: readonly SectionDefinition[] = Object.freeze([
  {
    sectionType: "app-slot",
    pageKeys: ["home", "product"],
    settingsSchema: textSchema(["slotName"]),
    // The fragment is HTML the server has already sanitised; it is not escaped again.
    renderSection: ({ settings, pageData, readText }) => {
      const fragment = new Map(Object.entries(pageData.slots)).get(readText(settings.slotName)) ?? "";
      return fragment === "" ? "" : `<section class="app-slot">${fragment}</section>`;
    },
  },
  {
    sectionType: "hero",
    pageKeys: ["home"],
    settingsSchema: textSchema(["heading", "subheading"]),
    renderSection: ({ settings, escape, readText }) =>
      `<section class="hero"><h1>${escape(readText(settings.heading))}</h1><p>${escape(readText(settings.subheading))}</p></section>`,
  },
  {
    sectionType: "rich-text",
    pageKeys: ["home", "product"],
    settingsSchema: textSchema(["text"]),
    renderSection: ({ settings, escape, readText }) => `<section class="rich-text"><p>${escape(readText(settings.text))}</p></section>`,
  },
  {
    sectionType: "product-grid",
    pageKeys: ["home"],
    settingsSchema: textSchema(["heading"]),
    renderSection: ({ settings, pageData, escape, readText }) =>
      `<section class="product-grid"><h2>${escape(readText(settings.heading))}</h2><ul>${pageData.products
        .map(
          (product) =>
            `<li><a href="/products/${escape(product.handle)}">${escape(product.title)}</a> <span>${escape(product.priceText)}</span></li>`,
        )
        .join("")}</ul></section>`,
  },
  {
    sectionType: "product-detail",
    pageKeys: ["product"],
    settingsSchema: textSchema([]),
    renderSection: ({ pageData, escape }) =>
      pageData.product === undefined
        ? ""
        : `<section class="product-detail"><h1>${escape(pageData.product.title)}</h1><p class="price">${escape(pageData.product.priceText)}</p>` +
          `<form method="post" action="/cart/lines"><input type="hidden" name="productId" value="${escape(pageData.product.productId)}">` +
          `<input type="number" name="quantity" value="1" min="1" max="99"><button>Add to cart</button></form></section>`,
  },
]);
