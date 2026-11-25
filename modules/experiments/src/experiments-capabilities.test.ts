import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStartExperimentCapability } from "./experiments-capabilities.ts";

const pageItem = (pageKey: string) => ({ capabilityName: "pages.page.set-sections", change: { pageKey, sections: [] } });

function buildSteps() {
  const changeSets: Record<string, { state: string; items: Array<{ capabilityName: string; change: unknown }> }> = {
    set_ok: { state: "approved", items: [pageItem("product")] },
    set_draft: { state: "draft", items: [pageItem("product")] },
    set_home: { state: "approved", items: [pageItem("home")] },
    set_price: { state: "approved", items: [pageItem("product"), { capabilityName: "catalog.product.rename", change: {} }] },
  };
  const running: Array<{ tenantId: string; experimentId: string; pageKey: string; variantChangeSetId: string; endsAt: string }> = [];
  return {
    running,
    findChangeSet: async (keys: { tenantId: string; changeSetId: string }) => (keys.tenantId === "tenant-a" ? changeSets[keys.changeSetId] : undefined),
    findRunningExperiment: async (query: { tenantId: string; pageKey: string }) => running.find((stored) => stored.tenantId === query.tenantId && stored.pageKey === query.pageKey),
    startExperiment: async (plan: { tenantId: string; pageKey: string; variantChangeSetId: string; endsAt: string }) => void running.push({ ...plan, experimentId: `exp_${running.length + 1}` }),
    stopExperiment: async (keys: { tenantId: string; experimentId: string }) => void running.splice(running.findIndex((stored) => stored.experimentId === keys.experimentId), 1),
    readNow: () => Date.parse("2026-11-25T12:00:00.000Z"),
  };
}

const candidate = { name: "Delivery note", pageKey: "product", variantChangeSetId: "set_ok", goalMetric: "add_to_cart", guardrailMetric: "checkout_paid" };

test("starting an experiment runs it until its end, and the revert stops it", async () => {
  const steps = buildSteps();
  const capability = buildStartExperimentCapability(steps);
  const item = await capability.buildChange({ tenantId: "tenant-a", candidate: { ...candidate, durationHours: 24 } });
  assert.equal(item.summary, 'Start experiment "Delivery note" on product');
  assert.equal((item.change as { trafficPercent: number }).trafficPercent, 50);
  await capability.applyChange({ tenantId: "tenant-a", change: item.change });
  assert.equal(steps.running[0]?.endsAt, "2026-11-26T12:00:00.000Z");
  await assert.rejects(capability.buildChange({ tenantId: "tenant-a", candidate }), { message: "An experiment is already running on product" });
  await capability.revertChange({ tenantId: "tenant-a", revert: item.revert });
  assert.equal(steps.running.length, 0);
});

test("a variant must be approved, change only the experiment's page, and the metrics must make sense", async () => {
  const capability = buildStartExperimentCapability(buildSteps());
  const refused = (changes: Record<string, unknown>, tenantId = "tenant-a") => capability.buildChange({ tenantId, candidate: { ...candidate, ...changes } });
  await assert.rejects(refused({ variantChangeSetId: "set_draft" }), { message: "The variant change set must be approved and not applied" });
  await assert.rejects(refused({ variantChangeSetId: "set_home" }), { message: "The variant may only change the experiment's page" });
  await assert.rejects(refused({ variantChangeSetId: "set_price" }), { message: "The variant may only change the experiment's page" });
  await assert.rejects(refused({}, "tenant-b"), { message: "Change set not found" });
  await assert.rejects(refused({ guardrailMetric: "add_to_cart" }), { message: "Invalid input: the guardrail must differ from the goal" });
  await assert.rejects(refused({ goalMetric: "page_view" }), { message: "Invalid input: metrics must be add_to_cart or checkout_paid" });
  await assert.rejects(refused({ trafficPercent: 95 }), { message: "Invalid input: trafficPercent must be a whole number from 10 to 90" });
  await assert.rejects(refused({ durationHours: 0 }), { message: "Invalid input: durationHours must be a whole number from 1 to 1440" });
});
