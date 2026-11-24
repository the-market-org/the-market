import assert from "node:assert/strict";
import { test } from "node:test";
import { listInputProblems } from "@the-market/core";
import type { CapabilityDefinition } from "@the-market/core";
import type { ChangeItemRecord } from "@the-market/module-changes";
import { addChangeToSet } from "./add-change-workflow.ts";

function buildRenameLike(buildCalls: unknown[]): CapabilityDefinition {
  return {
    name: "catalog.product.rename",
    summary: "Change a product's title",
    inputSchema: { type: "object", required: ["productId", "title"], properties: { productId: { type: "string" }, title: { type: "string" } } },
    risk: "low",
    buildChange: async (request) => {
      buildCalls.push(request.candidate);
      const candidate = request.candidate as { productId: string; title: string };
      if (candidate.productId !== "p1") {
        throw new Error("Product not found");
      }
      return {
        capabilityName: "catalog.product.rename",
        tenantId: request.tenantId,
        summary: `Rename "Lead" to "${candidate.title}"`,
        change: { productId: "p1", title: candidate.title },
        revert: { productId: "p1", title: "Lead" },
      };
    },
    applyChange: async () => {},
    revertChange: async () => {},
  };
}

function buildRun(input: { addItem?: (item: Omit<ChangeItemRecord, "itemId" | "position">) => Promise<ChangeItemRecord> } = {}) {
  const storedItems: unknown[] = [];
  const buildCalls: unknown[] = [];
  const addItem =
    input.addItem ??
    (async (item: Omit<ChangeItemRecord, "itemId" | "position">) => {
      storedItems.push(item);
      return { ...item, itemId: "item_1", position: 0 };
    });
  const run = (capabilityName: string, candidate: unknown) =>
    addChangeToSet({
      tenantId: "tenant-a",
      changeSetId: "set_1",
      capabilityName,
      candidate,
      capabilities: { "catalog.product.rename": buildRenameLike(buildCalls) },
      listProblems: listInputProblems,
      addItem,
    });
  return { run, storedItems, buildCalls };
}

test("valid input stores the item that buildChange worked out", async () => {
  const { run, storedItems } = buildRun();

  const item = await run("catalog.product.rename", { productId: "p1", title: "Rope lead" });

  assert.equal(item.summary, 'Rename "Lead" to "Rope lead"');
  assert.deepEqual(storedItems, [
    {
      tenantId: "tenant-a",
      changeSetId: "set_1",
      capabilityName: "catalog.product.rename",
      summary: 'Rename "Lead" to "Rope lead"',
      change: { productId: "p1", title: "Rope lead" },
      revert: { productId: "p1", title: "Lead" },
    },
  ]);
});

test("an unknown capability is refused and nothing is stored", async () => {
  const { run, storedItems } = buildRun();

  await assert.rejects(run("catalog.product.delete", {}), { message: "Unknown capability: catalog.product.delete" });
  await assert.rejects(run("toString", {}), { message: "Unknown capability: toString" });
  assert.deepEqual(storedItems, []);
});

test("invalid input is refused by field before buildChange runs", async () => {
  const { run, storedItems, buildCalls } = buildRun();

  await assert.rejects(run("catalog.product.rename", { productId: "p1" }), { message: "Invalid input: Missing field: title" });
  assert.deepEqual(buildCalls, []);
  assert.deepEqual(storedItems, []);
});

test("a buildChange failure stores nothing and passes its message on", async () => {
  const { run, storedItems } = buildRun();

  await assert.rejects(run("catalog.product.rename", { productId: "missing", title: "X" }), { message: "Product not found" });
  assert.deepEqual(storedItems, []);
});

test("an addItem refusal is passed through", async () => {
  const { run } = buildRun({
    addItem: async () => {
      throw new Error("Change set is not a draft");
    },
  });

  await assert.rejects(run("catalog.product.rename", { productId: "p1", title: "Rope lead" }), {
    message: "Change set is not a draft",
  });
});
