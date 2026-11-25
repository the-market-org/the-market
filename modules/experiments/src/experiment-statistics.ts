/**
 * Visitor assignment and the fixed statistics that decide an experiment.
 * Pure functions: the model never judges an outcome; this code does.
 */

type Arm = { visitors: number; conversions: number };
export type Arms = { control: Arm; variant: Arm };
export type Score = { zScore: number; pValue: number };

const MIN_VISITORS_PER_ARM = 100;
const GUARDRAIL_Z = -1.645; // one-sided, 5%
const GOAL_Z = 1.96; // two-sided, 5%

/** The arm for a visitor: stable for one experiment and visitor, `variant` for about trafficPercent of visitors. */
export function assignArm(input: { experimentId: string; visitorKey: string; trafficPercent: number; digest: (text: string) => Uint8Array }): string {
  const bytes = input.digest(`${input.experimentId}:${input.visitorKey}`);
  const bucket = (((bytes[0] ?? 0) * 2 ** 24 + (bytes[1] ?? 0) * 2 ** 16 + (bytes[2] ?? 0) * 2 ** 8 + (bytes[3] ?? 0)) >>> 0) % 100;
  return bucket < input.trafficPercent ? "variant" : "control";
}

/** The error function, Abramowitz and Stegun 7.1.26 (error below 1.5e-7). */
export function computeErf(value: number): number {
  const size = Math.abs(value);
  const step = 1 / (1 + 0.3275911 * size);
  const series = step * (0.254829592 + step * (-0.284496736 + step * (1.421413741 + step * (-1.453152027 + step * 1.061405429))));
  return Math.sign(value) * (1 - series * Math.exp(-size * size));
}

/** The standard normal cumulative distribution at z. */
export function computeNormalCdf(input: { zScore: number; erf: (value: number) => number }): number {
  return 0.5 * (1 + input.erf(input.zScore / Math.SQRT2));
}

/** Pooled two-proportion z-score of variant minus control, with its two-sided p-value. */
export function scoreProportions(input: Arms & { cumulative: (zScore: number) => number }): Score {
  const pooled = (input.control.conversions + input.variant.conversions) / (input.control.visitors + input.variant.visitors);
  const spread = Math.sqrt(pooled * (1 - pooled) * (1 / input.control.visitors + 1 / input.variant.visitors));
  const difference = input.variant.conversions / input.variant.visitors - input.control.conversions / input.control.visitors;
  const zScore = spread > 0 ? difference / spread : 0;
  return { zScore, pValue: 2 * (1 - input.cumulative(Math.abs(zScore))) };
}

/** The first rule that applies decides: too few visitors, a falling guardrail, then the goal. */
export function decideOutcome(input: { goal: Arms; guardrail: Arms; score: (arms: Arms) => Score }) {
  const goalScore = input.score(input.goal);
  const guardrailScore = input.score(input.guardrail);
  const fewest = Math.min(input.goal.control.visitors, input.goal.variant.visitors);
  const rules = [
    { applies: fewest < MIN_VISITORS_PER_ARM, decision: "unclear", reason: "Not enough visitors" },
    { applies: guardrailScore.zScore <= GUARDRAIL_Z, decision: "discard", reason: "Guardrail fell" },
    { applies: goalScore.zScore >= GOAL_Z, decision: "adopt", reason: "Goal rose" },
    { applies: goalScore.zScore <= -GOAL_Z, decision: "discard", reason: "Goal fell" },
    { applies: true, decision: "unclear", reason: "No clear difference" },
  ];
  const chosen = rules.find((rule) => rule.applies) ?? { decision: "unclear", reason: "No clear difference" };
  return { decision: chosen.decision, reason: chosen.reason, goal: { ...input.goal, ...goalScore }, guardrail: { ...input.guardrail, ...guardrailScore } };
}
