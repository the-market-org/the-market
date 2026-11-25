/**
 * Variant pages: when a running experiment covers a page, the visitor's arm comes from a stable hash,
 * so the page never waits for storage; the exposure is recorded without waiting. A variant visitor sees
 * the variant change set's sections. When the experiment cannot be read, the live page (control) is shown.
 */
import type { ChangeItemRecord } from "@the-market/module-changes";
import type { PageSection } from "@the-market/theme-engine";

type Experiment = { experimentId: string; variantChangeSetId: string; trafficPercent: number };
type ChangeItems = ChangeItemRecord[];

export interface VariantSteps {
  findRunning: (input: { tenantId: string; pageKey: string }) => Promise<Experiment | undefined>;
  assign: (input: { experimentId: string; visitorKey: string; trafficPercent: number }) => string;
  recordExposure: (input: { tenantId: string; experimentId: string; visitorKey: string; arm: string }) => Promise<string>;
  findItems: (input: { tenantId: string; changeSetId: string }) => Promise<ChangeItems>;
  findSections: (input: { items: ChangeItems; pageKey: string }) => PageSection[] | undefined;
}

type Visit = { tenantId: string; pageKey: string; visitorKey: string };

/** The visitor's arm for this experiment; the exposure write starts now and its failure is dropped. */
export function recordArm(input: Visit & { experiment: Experiment; steps: VariantSteps }): string {
  const { experiment, steps } = input;
  const arm = steps.assign({ experimentId: experiment.experimentId, visitorKey: input.visitorKey, trafficPercent: experiment.trafficPercent });
  void steps.recordExposure({ tenantId: input.tenantId, experimentId: experiment.experimentId, visitorKey: input.visitorKey, arm }).catch(() => undefined);
  return arm;
}

/** The variant's sections for a variant visitor of a running experiment on this page; otherwise undefined. */
export async function chooseVariantSections(input: Visit & { steps: VariantSteps }): Promise<PageSection[] | undefined> {
  const { steps } = input;
  const experiment = await steps.findRunning({ tenantId: input.tenantId, pageKey: input.pageKey }).catch(() => undefined);
  const arm = experiment === undefined ? "control" : recordArm({ ...input, experiment });
  const items = arm === "variant" ? await steps.findItems({ tenantId: input.tenantId, changeSetId: String(experiment?.variantChangeSetId) }).catch(() => []) : [];
  return steps.findSections({ items, pageKey: input.pageKey });
}
