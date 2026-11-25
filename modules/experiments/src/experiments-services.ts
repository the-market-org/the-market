import type { ServiceMap } from "@the-market/core";
import type { Arms, Score } from "./experiment-statistics.ts";
import type { ExperimentRecord, ExperimentsDatabase } from "./experiments-types.ts";

type ExperimentKeys = { tenantId: string; experimentId: string };
type Decide = (input: { goal: Arms; guardrail: Arms; score: (arms: Arms) => Score }) => unknown;

/** The storefront events that are recorded, and the ones an experiment can measure. */
export const EVENT_NAMES: readonly string[] = Object.freeze(["page_view", "add_to_cart", "checkout_paid"]);
export const METRIC_NAMES: readonly string[] = Object.freeze(["add_to_cart", "checkout_paid"]);

/** Refuses an event name the store does not record. */
export function checkEventName(eventName: string): void {
  if (!EVENT_NAMES.includes(eventName)) {
    throw new Error(`Invalid input: unknown event ${eventName}`);
  }
}

/** The store's experiment, or `Experiment not found`. */
export function requireExperiment(experiment: ExperimentRecord | undefined): ExperimentRecord {
  if (experiment === undefined) {
    throw new Error("Experiment not found");
  }
  return experiment;
}

/** Refuses an experiment that is not running, or has not reached its end. */
export function requireEnded(input: { state: string; endsAt: string; now: string }): void {
  if (input.state !== "running") {
    throw new Error("Experiment is not running");
  }
  if (input.now < input.endsAt) {
    throw new Error("Experiment is still running");
  }
}

export function buildExperimentsServices(input: {
  database: ExperimentsDatabase;
  decide: Decide;
  score: (arms: Arms) => Score;
}): ServiceMap {
  const { database } = input;
  const find = async (keys: ExperimentKeys) => requireExperiment(await database.findExperiment({ tenantId: keys.tenantId, experimentId: keys.experimentId }));
  const measure = async (keys: ExperimentKeys) => {
    const experiment = await find(keys);
    const count = (eventName: string) => database.countMetric({ tenantId: keys.tenantId, experimentId: keys.experimentId, eventName });
    return { goal: await count(experiment.goalMetric), guardrail: await count(experiment.guardrailMetric) };
  };
  return {
    startExperiment: (request: Omit<ExperimentRecord, "experimentId" | "state" | "startedAt" | "outcome">) => database.insertExperiment(request),
    /** Stops a running experiment; stopping one that is not running changes nothing. */
    stopExperiment: async (keys: ExperimentKeys) => {
      await database.updateExperimentState({ tenantId: keys.tenantId, experimentId: keys.experimentId, fromState: "running", toState: "stopped" });
    },
    findExperiment: find,
    listExperiments: (request: { tenantId: string }) => database.listExperiments({ tenantId: request.tenantId }),
    findRunningExperiment: (request: { tenantId: string; pageKey: string }) => database.findRunningExperiment({ tenantId: request.tenantId, pageKey: request.pageKey }),
    recordEvent: async (request: { tenantId: string; visitorKey: string; eventName: string; pageKey: string }) => {
      checkEventName(request.eventName);
      await database.insertEvent({ tenantId: request.tenantId, visitorKey: request.visitorKey, eventName: request.eventName, pageKey: request.pageKey });
    },
    recordExposure: (request: ExperimentKeys & { visitorKey: string; arm: string }) =>
      database.recordExposure({ tenantId: request.tenantId, experimentId: request.experimentId, visitorKey: request.visitorKey, arm: request.arm }),
    measureExperiment: measure,
    /** Decides an ended experiment once, from fixed statistics, and keeps the numbers with the decision. */
    decideExperiment: async (request: ExperimentKeys & { now: string }) => {
      const experiment = await find(request);
      requireEnded({ state: experiment.state, endsAt: experiment.endsAt, now: request.now });
      const outcome = input.decide({ ...(await measure(request)), score: input.score });
      const moved = await database.updateExperimentState({ tenantId: request.tenantId, experimentId: request.experimentId, fromState: "running", toState: "decided", outcome });
      return moved === 1 ? { ...experiment, state: "decided", outcome } : Promise.reject(new Error("Experiment is not running"));
    },
    /** Marks a decided experiment adopted, once its variant has been applied. */
    markAdopted: async (keys: ExperimentKeys) =>
      database.updateExperimentState({ tenantId: keys.tenantId, experimentId: keys.experimentId, fromState: "decided", toState: "adopted" }),
  };
}
