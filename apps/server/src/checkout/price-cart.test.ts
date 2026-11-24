import assert from "node:assert/strict";
import { test } from "node:test";
import { priceCart, priceLine } from "./price-cart.ts";

const products = [
  { productId: "p-lead", title: "Rope lead", priceMinor: 1800, currencyCode: "GBP" },
  { productId: "p-toy", title: "Chew toy", priceMinor: 700, currencyCode: "GBP" },
  { productId: "p-euro", title: "Euro bowl", priceMinor: 900, currencyCode: "EUR" },
];

function price(lines: Array<{ productId: string; quantity: number }>) {
  return priceCart({ lines, products, priceOne: priceLine });
}

test("each line is priced from the catalog and the total adds up", () => {
  assert.deepEqual(price([{ productId: "p-lead", quantity: 2 }, { productId: "p-toy", quantity: 1 }]), {
    currencyCode: "GBP",
    totalMinor: 4300,
    lines: [
      { productId: "p-lead", title: "Rope lead", quantity: 2, unitPriceMinor: 1800, lineTotalMinor: 3600 },
      { productId: "p-toy", title: "Chew toy", quantity: 1, unitPriceMinor: 700, lineTotalMinor: 700 },
    ],
  });
});

test("a missing product, mixed currencies and an empty cart are refused", () => {
  assert.throws(() => price([{ productId: "p-gone", quantity: 1 }]), { message: "Product not available: p-gone" });
  assert.throws(() => price([{ productId: "p-lead", quantity: 1 }, { productId: "p-euro", quantity: 1 }]), { message: "Cart mixes currencies" });
  assert.throws(() => price([]), { message: "Cart is empty" });
});
