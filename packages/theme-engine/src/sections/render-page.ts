/** Renders a page, an ordered list of sections, into a full HTML document. */
import type { PageData, PageSection, SectionDefinition } from "./section-types.ts";

/** What a store shows when it has not saved a page: it still sells with no agent. */
export const DEFAULT_PAGES: Readonly<Record<string, PageSection[]>> = Object.freeze({
  home: [
    { sectionType: "hero", settings: { heading: "Welcome", subheading: "Have a look around." } },
    { sectionType: "product-grid", settings: { heading: "Products" } },
  ],
  product: [{ sectionType: "product-detail", settings: {} }],
});

/** A price in minor units as the shopper reads it, for example "£18.00". */
export function formatPrice(input: { priceMinor: number; currencyCode: string }): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: input.currencyCode }).format(input.priceMinor / 100);
}

export function renderPage(input: {
  sections: PageSection[];
  pageData: PageData;
  definitions: readonly SectionDefinition[];
  escape: (text: string) => string;
  readText: (value: unknown) => string;
}): string {
  const definitions = new Map(input.definitions.map((definition) => [definition.sectionType, definition]));
  const body = input.sections
    .map(
      (section) =>
        definitions.get(section.sectionType)?.renderSection({
          settings: section.settings,
          pageData: input.pageData,
          escape: input.escape,
          readText: input.readText,
        }) ?? "",
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${input.escape(input.pageData.storeName)}</title></head><body><main>${body}</main></body></html>`;
}
