import assert from "node:assert/strict";
import { test } from "node:test";
import { addCapability, collectCapabilities, listDeclaredCapabilities, listInputProblems } from "@the-market/core";
import { buildRenameCapability } from "./catalog-capabilities.ts";
import { catalogModule } from "./index.ts";

/** Fake services holding one product, p1, titled "Lead", for tenant-a only. */
function buildFakeServices() {
  const titles: Record<string, string> = { p1: "Lead" };
  const renameCalls: string[] = [];
  return {
    titles,
    renameCalls,
    findProduct: async (request: { tenantId: string; productId: string }) =>
      request.tenantId === "tenant-a" && request.productId in titles ? { title: String(titles[request.productId]) } : undefined,
    renameProduct: async (request: { tenantId: string; productId: string; title: string }) => {
      renameCalls.push(request.title);
      titles[request.productId] = request.title;
    },
  };
}

test("the capability declares its fixed name, summary, risk and input schema", () => {
  const capability = buildRenameCapability(buildFakeServices());

  assert.equal(capability.name, "catalog.product.rename");
  assert.equal(capability.summary, "Change a product's title");
  assert.equal(capability.risk, "low");
  assert.deepEqual(listInputProblems({ inputSchema: capability.inputSchema, candidate: { productId: "p1" } }), [
    "Missing field: title",
  ]);
});

test("buildChange works out the change and its undo without renaming anything", async () => {
  const services = buildFakeServices();
  const capability = buildRenameCapability(services);

  const changeItem = await capability.buildChange({
    tenantId: "tenant-a",
    candidate: { productId: "p1", title: "Rope lead" },
  });

  assert.deepEqual(changeItem, {
    capabilityName: "catalog.product.rename",
    tenantId: "tenant-a",
    summary: 'Rename "Lead" to "Rope lead"',
    change: { productId: "p1", title: "Rope lead" },
    revert: { productId: "p1", title: "Lead" },
  });
  assert.deepEqual(services.renameCalls, []);
});

test("applyChange then revertChange restores the exact previous title", async () => {
  const services = buildFakeServices();
  const capability = buildRenameCapability(services);
  const changeItem = await capability.buildChange({
    tenantId: "tenant-a",
    candidate: { productId: "p1", title: "Rope lead" },
  });

  await capability.applyChange({ tenantId: "tenant-a", change: changeItem.change });
  assert.equal(services.titles.p1, "Rope lead");

  await capability.revertChange({ tenantId: "tenant-a", revert: changeItem.revert });
  assert.equal(services.titles.p1, "Lead");
});

test("buildChange for an unknown product, or another tenant's, rejects with Product not found", async () => {
  const capability = buildRenameCapability(buildFakeServices());

  await assert.rejects(capability.buildChange({ tenantId: "tenant-a", candidate: { productId: "nope", title: "X" } }), {
    message: "Product not found",
  });
  await assert.rejects(capability.buildChange({ tenantId: "tenant-b", candidate: { productId: "p1", title: "X" } }), {
    message: "Product not found",
  });
});

test("the catalog module declares the rename capability", () => {
  const capabilities = collectCapabilities({
    definitions: [catalogModule],
    registry: { catalog: buildFakeServices() },
    listDeclared: listDeclaredCapabilities,
    addOne: addCapability,
  });

  assert.deepEqual(Object.keys(capabilities), ["catalog.product.rename"]);
});
