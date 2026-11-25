import assert from "node:assert/strict";
import { test } from "node:test";
import { addCapability, collectCapabilities, listDeclaredCapabilities } from "@the-market/core";
import { buildSlotBindCapability } from "./apps-capabilities.ts";
import { appsModule } from "./index.ts";

function buildFakeServices(input: { status?: string; previous?: { skillId: string; priority: number } } = {}) {
  const bindings = new Map<string, { skillId: string; priority: number }>(input.previous ? [["product.below-detail", input.previous]] : []);
  const apps: Record<string, { name: string; status: string; slotSkills: string[] }> = { app_1: { name: "Review stars", status: input.status ?? "active", slotSkills: ["review-stars"] } };
  return {
    bindings,
    findApp: async (keys: { tenantId: string; appId: string }) => (keys.tenantId === "tenant-a" ? apps[keys.appId] : undefined),
    findBinding: async (keys: { slotName: string }) => bindings.get(keys.slotName),
    setBinding: async (binding: { slotName: string; skillId: string; priority: number }) => void bindings.set(binding.slotName, { skillId: binding.skillId, priority: binding.priority }),
    removeBinding: async (keys: { slotName: string }) => void bindings.delete(keys.slotName),
  };
}

const candidate = { appId: "app_1", skillId: "review-stars", slotName: "product.below-detail" };

function build(services = buildFakeServices(), input: Record<string, unknown> = candidate, tenantId = "tenant-a") {
  return buildSlotBindCapability(services).buildChange({ tenantId, candidate: input });
}

test("binding an active app's skill builds the change and a revert that removes it", async () => {
  const services = buildFakeServices();
  const capability = buildSlotBindCapability(services);
  const item = await capability.buildChange({ tenantId: "tenant-a", candidate });
  assert.equal(item.summary, "Show Review stars in product.below-detail");
  assert.deepEqual(item.revert, { appId: "app_1", slotName: "product.below-detail", remove: true });

  await capability.applyChange({ tenantId: "tenant-a", change: item.change });
  assert.deepEqual(services.bindings.get("product.below-detail"), { skillId: "review-stars", priority: 100 });
  await capability.revertChange({ tenantId: "tenant-a", revert: item.revert });
  assert.equal(services.bindings.has("product.below-detail"), false);
});

test("reverting restores the previous binding's priority", async () => {
  const services = buildFakeServices({ previous: { skillId: "review-stars", priority: 20 } });
  const capability = buildSlotBindCapability(services);
  const item = await capability.buildChange({ tenantId: "tenant-a", candidate: { ...candidate, priority: 5 } });
  await capability.applyChange({ tenantId: "tenant-a", change: item.change });
  await capability.revertChange({ tenantId: "tenant-a", revert: item.revert });
  assert.deepEqual(services.bindings.get("product.below-detail"), { skillId: "review-stars", priority: 20 });
});

test("an unknown slot, an unknown skill, an inactive app and another store's app are refused", async () => {
  await assert.rejects(build(buildFakeServices(), { ...candidate, slotName: "footer" }), { message: "Unknown slot: footer" });
  await assert.rejects(build(buildFakeServices(), { ...candidate, skillId: "chat" }), { message: "The app does not offer chat" });
  await assert.rejects(build(buildFakeServices({ status: "pending" })), { message: "App is not active" });
  await assert.rejects(build(buildFakeServices(), candidate, "tenant-b"), { message: "App not found" });
});

test("the apps module declares the capability, at medium risk", () => {
  const capabilities = collectCapabilities({ definitions: [appsModule], registry: { apps: buildFakeServices() }, listDeclared: listDeclaredCapabilities, addOne: addCapability });
  assert.deepEqual([Object.keys(capabilities), capabilities["apps.slot.bind"]?.risk], [["apps.slot.bind"], "medium"]);
});
