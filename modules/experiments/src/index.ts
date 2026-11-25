import { defineModule } from "@the-market/core";
import type { ModuleContext, ServiceMap } from "@the-market/core";
import { computeErf, computeNormalCdf, decideOutcome, scoreProportions } from "./experiment-statistics.ts";
import { buildExperimentsServices } from "./experiments-services.ts";
import { buildExperimentsDatabase } from "./prisma-experiments-database.ts";

export type { ArmCounts, ExperimentRecord, ExperimentsDatabase } from "./experiments-types.ts";
export { assignArm } from "./experiment-statistics.ts";
export { buildStartExperimentCapability } from "./experiments-capabilities.ts";
export { EVENT_NAMES, METRIC_NAMES } from "./experiments-services.ts";
export { buildExperimentsDatabase } from "./prisma-experiments-database.ts";

/**
 * Composition root of the experiments module: connects the services and the
 * fixed statistics to the module's own "experiments" PostgreSQL schema.
 */
export function registerExperiments(context: ModuleContext): ServiceMap {
  const cumulative = (zScore: number) => computeNormalCdf({ zScore, erf: computeErf });
  return buildExperimentsServices({
    database: buildExperimentsDatabase({ databaseUrl: context.databaseUrl }),
    decide: decideOutcome,
    score: (arms) => scoreProportions({ ...arms, cumulative }),
  });
}

export const experimentsModule = defineModule({
  name: "experiments",
  version: "0.0.0",
  schemaName: "experiments",
  dependsOn: [],
  register: registerExperiments,
});
