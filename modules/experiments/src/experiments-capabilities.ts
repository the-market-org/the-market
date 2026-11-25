/** `experiments.start`: starts an experiment whose variant is an approved, unapplied change set of one page's sections. */
import type { CapabilityDefinition } from "@the-market/core";
import { METRIC_NAMES } from "./experiments-services.ts";

type ChangeSet = { state: string; items: Array<{ capabilityName: string; change: unknown }> };
type Plan = { name: string; pageKey: string; variantChangeSetId: string; goalMetric: string; guardrailMetric: string; trafficPercent: number; durationHours: number };

interface StartSteps {
  findChangeSet: (input: { tenantId: string; changeSetId: string }) => Promise<ChangeSet | undefined>;
  findRunningExperiment: (input: { tenantId: string; pageKey: string }) => Promise<{ experimentId: string; variantChangeSetId: string } | undefined>;
  startExperiment: (input: Omit<Plan, "durationHours"> & { tenantId: string; endsAt: string }) => Promise<unknown>;
  stopExperiment: (input: { tenantId: string; experimentId: string }) => Promise<void>;
  readNow: () => number;
}

const HOUR_MS = 3600000;

const TEXT_FIELDS = ["name", "pageKey", "variantChangeSetId", "goalMetric", "guardrailMetric"];
const START_SCHEMA: Record<string, unknown> = Object.freeze({
  type: "object",
  required: TEXT_FIELDS,
  properties: Object.fromEntries([...TEXT_FIELDS.map((field) => [field, { type: "string" }]), ["trafficPercent", { type: "number" }], ["durationHours", { type: "number" }]]),
});

/** Refuses unknown metrics, and a guardrail that is the goal. */
export function checkMetrics(input: { goalMetric: string; guardrailMetric: string }): void {
  if (![input.goalMetric, input.guardrailMetric].every((metric) => METRIC_NAMES.includes(metric))) {
    throw new Error(`Invalid input: metrics must be ${METRIC_NAMES.join(" or ")}`);
  }
  if (input.goalMetric === input.guardrailMetric) {
    throw new Error("Invalid input: the guardrail must differ from the goal");
  }
}

/** Refuses a whole number outside its range. */
export function checkRange(input: { value: number; low: number; high: number; label: string }): void {
  if (!(Number.isInteger(input.value) && input.value >= input.low && input.value <= input.high)) {
    throw new Error(`Invalid input: ${input.label} must be a whole number from ${input.low} to ${input.high}`);
  }
}

/** The variant change set, when it exists and is approved but not applied. */
export function requireApprovedVariant(changeSet: ChangeSet | undefined): ChangeSet {
  if (changeSet === undefined) {
    throw new Error("Change set not found");
  }
  if (changeSet.state !== "approved") {
    throw new Error("The variant change set must be approved and not applied");
  }
  return changeSet;
}

/** Refuses a variant that changes anything but this page's sections. */
export function checkVariantPage(input: { items: ChangeSet["items"]; pageKey: string }): void {
  const onPage = (item: ChangeSet["items"][number]) => item.capabilityName === "pages.page.set-sections" && (item.change as { pageKey?: string }).pageKey === input.pageKey;
  if (input.items.length === 0 || !input.items.every(onPage)) {
    throw new Error("The variant may only change the experiment's page");
  }
}

/** Refuses a page that already has a running experiment. */
export function checkPageFree(input: { running: unknown; pageKey: string }): void {
  if (input.running !== undefined) {
    throw new Error(`An experiment is already running on ${input.pageKey}`);
  }
}

export function buildStartExperimentCapability(steps: StartSteps): CapabilityDefinition {
  const capabilityName = "experiments.start";
  return {
    name: capabilityName,
    summary: "Start an experiment on a storefront page",
    inputSchema: START_SCHEMA,
    risk: "medium",
    buildChange: async (request) => {
      const candidate = request.candidate as Omit<Plan, "trafficPercent" | "durationHours"> & Partial<Plan>;
      const plan: Plan = { ...candidate, trafficPercent: candidate.trafficPercent ?? 50, durationHours: candidate.durationHours ?? 336 };
      checkMetrics(plan);
      checkRange({ value: plan.trafficPercent, low: 10, high: 90, label: "trafficPercent" });
      checkRange({ value: plan.durationHours, low: 1, high: 1440, label: "durationHours" });
      const variant = requireApprovedVariant(await steps.findChangeSet({ tenantId: request.tenantId, changeSetId: plan.variantChangeSetId }));
      checkVariantPage({ items: variant.items, pageKey: plan.pageKey });
      checkPageFree({ running: await steps.findRunningExperiment({ tenantId: request.tenantId, pageKey: plan.pageKey }), pageKey: plan.pageKey });
      return {
        capabilityName,
        tenantId: request.tenantId,
        summary: `Start experiment "${plan.name}" on ${plan.pageKey}`,
        change: plan,
        revert: { pageKey: plan.pageKey, variantChangeSetId: plan.variantChangeSetId },
      };
    },
    applyChange: async (request) => {
      const { durationHours, ...plan } = request.change as Plan;
      await steps.startExperiment({ ...plan, tenantId: request.tenantId, endsAt: new Date(steps.readNow() + durationHours * HOUR_MS).toISOString() });
    },
    /** Stops the running experiment this change started; one already ended or replaced is left alone. */
    revertChange: async (request) => {
      const revert = request.revert as { pageKey: string; variantChangeSetId: string };
      const running = await steps.findRunningExperiment({ tenantId: request.tenantId, pageKey: revert.pageKey });
      await (running?.variantChangeSetId === revert.variantChangeSetId ? steps.stopExperiment({ tenantId: request.tenantId, experimentId: running.experimentId }) : Promise.resolve());
    },
  };
}
