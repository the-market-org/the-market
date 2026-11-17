/** The example agent's plan: plain data, built from what the store already has. Escaping is the store's job. */

export interface PlannedCall {
  name: string;
  toolArguments: Record<string, unknown>;
}

export function buildStarterPlan(input: { storeName: string; productCount: number }): PlannedCall[] {
  const productWord = input.productCount === 1 ? "product" : "products";
  return [
    {
      name: "pages.page.set-sections",
      toolArguments: {
        pageKey: "home",
        sections: [
          { sectionType: "hero", settings: { heading: `Welcome to ${input.storeName}`, subheading: `${input.productCount} ${productWord}, chosen with care.` } },
          { sectionType: "rich-text", settings: { text: "Every order is packed by hand and sent within two working days." } },
          { sectionType: "product-grid", settings: { heading: "Shop the range" } },
        ],
      },
    },
    {
      name: "pages.page.set-sections",
      toolArguments: {
        pageKey: "product",
        sections: [
          { sectionType: "product-detail", settings: {} },
          { sectionType: "rich-text", settings: { text: "Free returns within 30 days." } },
        ],
      },
    },
  ];
}
