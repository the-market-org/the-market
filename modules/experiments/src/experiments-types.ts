/** An experiment as the services see it. */
export interface ExperimentRecord {
  experimentId: string;
  tenantId: string;
  name: string;
  pageKey: string;
  variantChangeSetId: string;
  goalMetric: string;
  guardrailMetric: string;
  trafficPercent: number;
  state: string;
  startedAt: string;
  endsAt: string;
  outcome: unknown;
}

/** Exposed visitors per arm, and how many of them went on to the metric's event. */
export type ArmCounts = Record<"control" | "variant", { visitors: number; conversions: number }>;

type ExperimentKeys = { tenantId: string; experimentId: string };

/** What the services need from storage. The Prisma adapter implements it. */
export interface ExperimentsDatabase {
  insertEvent: (input: { tenantId: string; visitorKey: string; eventName: string; pageKey: string }) => Promise<void>;
  insertExperiment: (input: Omit<ExperimentRecord, "experimentId" | "state" | "startedAt" | "outcome">) => Promise<ExperimentRecord>;
  findExperiment: (input: ExperimentKeys) => Promise<ExperimentRecord | undefined>;
  listExperiments: (input: { tenantId: string }) => Promise<ExperimentRecord[]>;
  findRunningExperiment: (input: { tenantId: string; pageKey: string }) => Promise<ExperimentRecord | undefined>;
  /** Changes the state only from the stated one, with an optional outcome. Returns rows changed, 0 or 1. */
  updateExperimentState: (input: ExperimentKeys & { fromState: string; toState: string; outcome?: unknown }) => Promise<number>;
  /** Records the visitor's arm the first time; afterwards returns the arm already stored. */
  recordExposure: (input: ExperimentKeys & { visitorKey: string; arm: string }) => Promise<string>;
  countMetric: (input: ExperimentKeys & { eventName: string }) => Promise<ArmCounts>;
}
