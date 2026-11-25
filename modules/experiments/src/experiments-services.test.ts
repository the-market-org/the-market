import assert from "node:assert/strict";
import { test } from "node:test";
import { computeErf, computeNormalCdf, decideOutcome, scoreProportions } from "./experiment-statistics.ts";
import type { Arms } from "./experiment-statistics.ts";
import { buildExperimentsServices } from "./experiments-services.ts";
import type { ArmCounts, ExperimentRecord, ExperimentsDatabase } from "./experiments-types.ts";

function buildFakeDatabase(counts: Record<string, ArmCounts>): ExperimentsDatabase & { events: unknown[] } {
  const experiments: ExperimentRecord[] = [];
  const events: unknown[] = [];
  const find = (keys: { tenantId: string; experimentId: string }) => experiments.find((stored) => stored.tenantId === keys.tenantId && stored.experimentId === keys.experimentId);
  return {
    events,
    insertEvent: async (event) => void events.push(event),
    insertExperiment: async (plan) => {
      const record = { ...plan, experimentId: `exp_${experiments.length + 1}`, state: "running", startedAt: "2026-11-25T00:00:00.000Z", outcome: null };
      experiments.push(record);
      return record;
    },
    findExperiment: async (keys) => find(keys),
    listExperiments: async (query) => experiments.filter((stored) => stored.tenantId === query.tenantId),
    findRunningExperiment: async (query) => experiments.find((stored) => stored.tenantId === query.tenantId && stored.pageKey === query.pageKey && stored.state === "running"),
    updateExperimentState: async (move) => {
      const stored = find(move);
      const matches = stored?.state === move.fromState;
      Object.assign(matches ? (stored as ExperimentRecord) : {}, { state: move.toState }, move.outcome === undefined ? {} : { outcome: move.outcome });
      return matches ? 1 : 0;
    },
    recordExposure: async (exposure) => exposure.arm,
    countMetric: async (query) => counts[query.eventName] ?? { control: { visitors: 0, conversions: 0 }, variant: { visitors: 0, conversions: 0 } },
  };
}

const arms = (control: number, variant: number) => ({ control: { visitors: 1000, conversions: control }, variant: { visitors: 1000, conversions: variant } });
const score = (counts: Arms) => scoreProportions({ ...counts, cumulative: (zScore) => computeNormalCdf({ zScore, erf: computeErf }) });
const plan = { tenantId: "tenant-a", name: "Delivery note", pageKey: "product", variantChangeSetId: "set_1", goalMetric: "add_to_cart", guardrailMetric: "checkout_paid", trafficPercent: 50, endsAt: "2026-12-09T00:00:00.000Z" };

type Services = Record<string, (input: Record<string, unknown>) => Promise<any>>;
function buildServices(database: ExperimentsDatabase): Services {
  return buildExperimentsServices({ database, decide: decideOutcome, score }) as unknown as Services;
}

test("an ended experiment is decided once, from its goal and guardrail counts", async () => {
  const services = buildServices(buildFakeDatabase({ add_to_cart: arms(30, 55), checkout_paid: arms(20, 22) }));
  const experiment = await services.startExperiment?.(plan);
  const keys = { tenantId: "tenant-a", experimentId: experiment.experimentId };
  await assert.rejects(services.decideExperiment?.({ ...keys, now: "2026-12-01T00:00:00.000Z" }) as Promise<unknown>, { message: "Experiment is still running" });
  const decided = await services.decideExperiment?.({ ...keys, now: "2026-12-10T00:00:00.000Z" });
  assert.deepEqual([decided.state, decided.outcome.decision, decided.outcome.goal.variant.conversions], ["decided", "adopt", 55]);
  await assert.rejects(services.decideExperiment?.({ ...keys, now: "2026-12-10T00:00:00.000Z" }) as Promise<unknown>, { message: "Experiment is not running" });
  assert.equal(await services.markAdopted?.(keys), 1);
  await assert.rejects(services.findExperiment?.({ tenantId: "tenant-b", experimentId: experiment.experimentId }) as Promise<unknown>, { message: "Experiment not found" });
});

test("a stopped experiment no longer runs and cannot be decided", async () => {
  const services = buildServices(buildFakeDatabase({}));
  const experiment = await services.startExperiment?.(plan);
  const keys = { tenantId: "tenant-a", experimentId: experiment.experimentId };
  await services.stopExperiment?.(keys);
  assert.equal(await services.findRunningExperiment?.({ tenantId: "tenant-a", pageKey: "product" }), undefined);
  await assert.rejects(services.decideExperiment?.({ ...keys, now: "2027-01-01T00:00:00.000Z" }) as Promise<unknown>, { message: "Experiment is not running" });
});

test("only known storefront events are recorded", async () => {
  const database = buildFakeDatabase({});
  const services = buildServices(database);
  await services.recordEvent?.({ tenantId: "tenant-a", visitorKey: "v1", eventName: "add_to_cart", pageKey: "product" });
  await assert.rejects(services.recordEvent?.({ tenantId: "tenant-a", visitorKey: "v1", eventName: "email_seen", pageKey: "" }) as Promise<unknown>, { message: "Invalid input: unknown event email_seen" });
  assert.equal(database.events.length, 1);
});
