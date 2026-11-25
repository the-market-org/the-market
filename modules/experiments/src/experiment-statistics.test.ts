import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { assignArm, computeErf, computeNormalCdf, decideOutcome, scoreProportions } from "./experiment-statistics.ts";
import type { Arms } from "./experiment-statistics.ts";

const digest = (text: string) => createHash("sha256").update(text).digest();
const cumulative = (zScore: number) => computeNormalCdf({ zScore, erf: computeErf });
const score = (arms: Arms) => scoreProportions({ ...arms, cumulative });
const arms = (control: number, variant: number, visitors = 1000) => ({ control: { visitors, conversions: control }, variant: { visitors, conversions: variant } });
const steady = arms(50, 50);

test("the normal distribution is accurate to 1e-4", () => {
  assert.ok(Math.abs(cumulative(1.96) - 0.975) < 1e-4);
  assert.ok(Math.abs(cumulative(-1.645) - 0.05) < 1e-4);
  assert.equal(cumulative(0), 0.5);
});

test("two-proportion scores match the reference values", () => {
  const rounded = (input: ReturnType<typeof score>) => [Number(input.zScore.toFixed(4)), Number(input.pValue.toFixed(4))];
  assert.deepEqual(rounded(score(arms(30, 55))), [2.7712, 0.0056]);
  assert.deepEqual(rounded(score(arms(30, 36))), [0.751, 0.4526]);
  assert.equal(Number(score(arms(60, 40)).zScore.toFixed(4)), -2.052);
  assert.equal(score(arms(0, 0)).zScore, 0, "no conversions at all is no difference");
});

test("decisions follow the fixed rules in order", () => {
  const decide = (goal: ReturnType<typeof arms>, guardrail = steady) => decideOutcome({ goal, guardrail, score });
  assert.equal(decide(arms(30, 55)).decision, "adopt");
  assert.equal(decide(arms(30, 36)).reason, "No clear difference");
  assert.equal(decide(arms(60, 40)).reason, "Goal fell");
  assert.deepEqual([decide(arms(30, 55), arms(60, 40)).decision, decide(arms(30, 55), arms(60, 40)).reason], ["discard", "Guardrail fell"]);
  assert.equal(decide(arms(3, 30, 99)).reason, "Not enough visitors");
  assert.equal(decide(arms(30, 55)).goal.variant.conversions, 55, "the numbers are kept with the decision");
});

test("a visitor always gets the same arm, and the split follows the traffic percent", () => {
  const experimentId = randomUUID();
  const arm = (visitorKey: string, trafficPercent = 50) => assignArm({ experimentId, visitorKey, trafficPercent, digest });
  assert.equal(arm("visitor-1"), arm("visitor-1"));
  const keys = Array.from({ length: 10000 }, (_unused, keyIndex) => `visitor-${keyIndex}`);
  const share = keys.filter((visitorKey) => arm(visitorKey) === "variant").length / keys.length;
  assert.ok(share > 0.48 && share < 0.52, `variant share ${share}`);
  assert.ok(keys.filter((visitorKey) => arm(visitorKey, 10) === "variant").length / keys.length < 0.12);
});
