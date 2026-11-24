import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStarterPlan } from "./starter-plan.ts";

test("the starter plan sets the home page and the product page", () => {
  assert.deepEqual(buildStarterPlan({ storeName: "Demo store", productCount: 6 }), [
    {
      name: "pages.page.set-sections",
      toolArguments: {
        pageKey: "home",
        sections: [
          { sectionType: "hero", settings: { heading: "Welcome to Demo store", subheading: "6 products, chosen with care." } },
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
  ]);
});

test("one product reads as singular, and the store name is passed through as text", () => {
  const [home] = buildStarterPlan({ storeName: "<b>Leads</b>", productCount: 1 });
  const hero = (home?.toolArguments.sections as Array<{ settings: Record<string, string> }>)[0]?.settings;
  assert.deepEqual(hero, { heading: "Welcome to <b>Leads</b>", subheading: "1 product, chosen with care." });
});
