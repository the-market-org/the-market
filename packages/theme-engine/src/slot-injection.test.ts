import assert from "node:assert/strict";
import { test } from "node:test";
import { addFragment, composeSlotHandler, renderSlotPlaceholder } from "./index.ts";
import type { SlotFragment } from "./index.ts";

function startTimer(callback: () => void, durationMs: number): void {
  setTimeout(callback, durationMs);
}

function buildFragments(): SlotFragment[] {
  const withReviews = addFragment({
    fragments: [],
    slotName: "product.below-title",
    appId: "reviews",
    priority: 20,
    renderFragment: async (pageValues) =>
      `<p onclick="steal()">4.6 stars for ${pageValues.productId}</p>` +
      `<script>alert(1)</script>` +
      `<button hx-get="/apps/reviews/list">More</button>` +
      `<button hx-post="/admin/orders/refund">Refund</button>`,
  });
  const withBadge = addFragment({
    fragments: withReviews,
    slotName: "product.below-title",
    appId: "badges",
    priority: 10,
    renderFragment: async () => "<span>Eco</span>",
  });
  const withBroken = addFragment({
    fragments: withBadge,
    slotName: "product.below-title",
    appId: "broken",
    priority: 5,
    renderFragment: async () => {
      throw new Error("app is down");
    },
  });
  return addFragment({
    fragments: withBroken,
    slotName: "product.below-title",
    appId: "slow",
    priority: 1,
    renderFragment: () => new Promise<string>(() => {}),
  });
}

test("renders app fragments in priority order, cleaned and fault isolated", async () => {
  const handleSlot = composeSlotHandler({ fragments: buildFragments(), timeoutMs: 20, startTimer });

  const reply = await handleSlot({ slotName: "product.below-title", pageValues: { productId: "prod_1" } });

  assert.equal(reply.status, 200);
  assert.equal(
    reply.bodyText,
    '<div id="slot-product-below-title-badges" data-slot="product.below-title" data-app="badges"><span>Eco</span></div>' +
      '<div id="slot-product-below-title-reviews" data-slot="product.below-title" data-app="reviews">' +
      '<p>4.6 stars for prod_1</p><button hx-get="/apps/reviews/list">More</button><button>Refund</button></div>',
  );
});

test("rejects unsafe slot names and returns nothing for an empty slot", async () => {
  const handleSlot = composeSlotHandler({ fragments: [], timeoutMs: 20, startTimer });
  assert.equal((await handleSlot({ slotName: '"><script>', pageValues: {} })).status, 400);
  assert.equal((await handleSlot({ slotName: "cart.summary", pageValues: {} })).bodyText, "");
});

test("prints a lazy htmx placeholder for theme templates", () => {
  assert.equal(
    renderSlotPlaceholder({ slotName: "product.below-title", queryString: "productId=prod_1" }),
    '<div hx-get="/partials/slots/product.below-title?productId=prod_1" hx-trigger="load" hx-swap="outerHTML"></div>',
  );
});
