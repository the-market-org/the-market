import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChangeItemRecord } from "@the-market/module-changes";
import { applyItem, applyItemsInOrder, describeError, revertItemsInReverse } from "./item-steps.ts";

const items: ChangeItemRecord[] = [0, 1, 2].map((position) => ({
  itemId: `item_${position}`,
  position,
  capabilityName: "catalog.product.rename",
  summary: "",
  change: { position },
  revert: { position },
}));

test("items are applied in order until one fails", async () => {
  const calls: number[] = [];
  const outcome = await applyItemsInOrder({
    tenantId: "tenant-a",
    items,
    applyOne: async (step) => {
      calls.push(step.item.position);
      return step.item.position === 1 ? Promise.reject(new Error("Product not found")) : undefined;
    },
    describe: describeError,
  });

  assert.deepEqual(calls, [0, 1]);
  assert.deepEqual(outcome, { appliedCount: 1, failureMessage: "Product not found" });
});

test("when every item applies, the outcome has no failure", async () => {
  const outcome = await applyItemsInOrder({ tenantId: "tenant-a", items, applyOne: async () => {}, describe: describeError });
  assert.deepEqual(outcome, { appliedCount: 3, failureMessage: "" });
});

test("items are reverted last first, and a failing revert names its item", async () => {
  const calls: number[] = [];
  await assert.rejects(
    revertItemsInReverse({
      tenantId: "tenant-a",
      items,
      revertOne: async (step) => {
        calls.push(step.item.position);
        return step.item.position === 1 ? Promise.reject(new Error("Product not found")) : undefined;
      },
      describe: describeError,
    }),
    { message: "Revert stopped at item 1: Product not found" },
  );
  assert.deepEqual(calls, [2, 1]);
});

test("an item whose capability is not registered is refused", async () => {
  await assert.rejects(applyItem({ tenantId: "tenant-a", item: items[0] as ChangeItemRecord, capabilities: {} }), {
    message: "Unknown capability: catalog.product.rename",
  });
});

test("describeError reads the message of anything thrown", () => {
  assert.equal(describeError(new Error("broken")), "broken");
  assert.equal(describeError("plain"), "plain");
});
