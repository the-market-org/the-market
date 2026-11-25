/** Merchant routes for experiments: list, read with live counts, decide after the end, adopt the variant. */
import { resolveService } from "@the-market/core";
import type { CapabilityRegistry, ModuleRegistry } from "@the-market/core";
import type { Route } from "../hono-adapter.ts";
import { applyChangeSet } from "../change-sets/apply-workflow.ts";
import { answerChangeSetError, answerSafely, replyJson } from "../change-sets/change-set-http.ts";
import { buildChangeSetSteps } from "../change-sets/compose-change-sets.ts";
import { describeError } from "../change-sets/item-steps.ts";

type Experiment = { experimentId: string; variantChangeSetId: string; state: string; outcome: unknown };
type Keys = { tenantId: string; experimentId: string };

const ADOPTABLE = Object.freeze(["adopt", "unclear"]);

/** Refuses an experiment that is not decided, or whose decision was to discard the variant. */
export function requireAdoptable(experiment: Experiment): void {
  const decision = (experiment.outcome as { decision?: string } | null)?.decision ?? "";
  if (experiment.state !== "decided" || !ADOPTABLE.includes(decision)) {
    throw new Error("Only an adopt or unclear outcome can be adopted");
  }
}

/** Applies the variant change set of a decided experiment, then marks it adopted. */
export async function adoptExperiment(input: Keys & {
  findExperiment: (keys: Keys) => Promise<Experiment>;
  applyVariant: (keys: { tenantId: string; changeSetId: string }) => Promise<void>;
  markAdopted: (keys: Keys) => Promise<unknown>;
}): Promise<Experiment> {
  const keys = { tenantId: input.tenantId, experimentId: input.experimentId };
  const experiment = await input.findExperiment(keys);
  requireAdoptable(experiment);
  await input.applyVariant({ tenantId: input.tenantId, changeSetId: experiment.variantChangeSetId });
  await input.markAdopted(keys);
  return { ...experiment, state: "adopted" };
}

export function composeExperimentRoutes(input: { registry: ModuleRegistry; capabilities: CapabilityRegistry; readNow: () => number }): Route[] {
  const call = (serviceName: string) => async (request: unknown) => (resolveService({ registry: input.registry, moduleName: "experiments", serviceName }) as (request: unknown) => Promise<any>)(request);
  const changeSetSteps = buildChangeSetSteps(input);
  const answer = (run: () => Promise<{ status: number; body: unknown }>) => answerSafely({ run: async () => replyJson(await run()), answerError: answerChangeSetError, describe: describeError });
  const keysOf = (request: { tenantId: string; pathParams: Record<string, string | undefined> }) => ({ tenantId: request.tenantId, experimentId: String(request.pathParams.experimentId) });
  const route = (method: Route["method"], path: string, handle: Route["handleRequest"]): Route => ({ method, path, tenantScoped: true, handleRequest: handle });
  return [
    route("GET", "/api/experiments", (request) => answer(async () => ({ status: 200, body: { experiments: await call("listExperiments")({ tenantId: request.tenantId }) } }))),
    route("GET", "/api/experiments/:experimentId", (request) =>
      answer(async () => ({ status: 200, body: { experiment: await call("findExperiment")(keysOf(request)), counts: await call("measureExperiment")(keysOf(request)) } })),
    ),
    route("POST", "/api/experiments/:experimentId/decide", (request) =>
      answer(async () => ({ status: 200, body: await call("decideExperiment")({ ...keysOf(request), now: new Date(input.readNow()).toISOString() }) })),
    ),
    route("POST", "/api/experiments/:experimentId/adopt", (request) =>
      answer(async () => ({
        status: 200,
        body: await adoptExperiment({ ...keysOf(request), findExperiment: call("findExperiment"), applyVariant: (keys) => applyChangeSet(changeSetSteps(keys)), markAdopted: call("markAdopted") }),
      })),
    ),
  ];
}
