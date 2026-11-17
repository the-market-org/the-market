/** The default theme's sections. Every value from the store passes through `escape`. */
import type { SectionDefinition } from "./section-types.ts";

const textSchema = (fieldNames: string[]) => ({
  type: "object",
  properties: Object.fromEntries(fieldNames.map((fieldName) => [fieldName, { type: "string" }])),
});

export const DEFAULT_SECTIONS: readonly SectionDefinition[] = Object.freeze([
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
        : `<section class="product-detail"><h1>${escape(pageData.product.title)}</h1><p class="price">${escape(pageData.product.priceText)}</p></section>`,
  },
]);
