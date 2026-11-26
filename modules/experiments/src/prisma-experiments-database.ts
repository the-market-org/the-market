/**
 * The only file in this module that touches Prisma. It implements the
 * ExperimentsDatabase port and is the only place that turns a tenant id into a query filter.
 */
import type { ArmCounts, ExperimentRecord, ExperimentsDatabase } from "./experiments-types.ts";
import { readQueryTenant, runAsTenant, scopeToTenant } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StoredExperiment = Omit<ExperimentRecord, "startedAt" | "endsAt"> & { startedAt: Date; endsAt: Date };

export function describeExperiment(stored: StoredExperiment): ExperimentRecord {
  return { ...stored, startedAt: stored.startedAt.toISOString(), endsAt: stored.endsAt.toISOString() };
}

/** Rows from the metric query folded into counts for both arms, zero when an arm has no visitors. */
export function foldArmCounts(rows: Array<{ arm: string; visitors: number; conversions: number }>): ArmCounts {
  const byArm = new Map(rows.map((row) => [row.arm, { visitors: row.visitors, conversions: row.conversions }]));
  return { control: byArm.get("control") ?? { visitors: 0, conversions: 0 }, variant: byArm.get("variant") ?? { visitors: 0, conversions: 0 } };
}

export function buildExperimentsDatabase(input: { databaseUrl: string }): ExperimentsDatabase & { disconnect: () => Promise<void> } {
  const client = scopeToTenant({ client: new PrismaClient({ datasourceUrl: input.databaseUrl }), readTenant: readQueryTenant });
  const keysOf = (keys: { tenantId: string; experimentId: string }) => ({ tenantId: keys.tenantId, experimentId: keys.experimentId });
  return {
    insertEvent: async (event) => {
      await client.telemetryEvent.create({ data: { tenantId: event.tenantId, visitorKey: event.visitorKey, eventName: event.eventName, pageKey: event.pageKey } });
    },
    insertExperiment: async (experiment) => describeExperiment((await client.experiment.create({ data: { ...experiment, endsAt: new Date(experiment.endsAt) } })) as StoredExperiment),
    findExperiment: async (keys) => (UUID_PATTERN.test(keys.experimentId) ? ((await client.experiment.findMany({ where: keysOf(keys) })) as StoredExperiment[]).map(describeExperiment)[0] : undefined),
    listExperiments: async (query) => ((await client.experiment.findMany({ where: { tenantId: query.tenantId }, orderBy: { startedAt: "desc" } })) as StoredExperiment[]).map(describeExperiment),
    findRunningExperiment: async (query) =>
      ((await client.experiment.findMany({ where: { tenantId: query.tenantId, pageKey: query.pageKey, state: "running" } })) as StoredExperiment[]).map(describeExperiment)[0],
    updateExperimentState: async (move) => {
      const outcome = move.outcome === undefined ? {} : { outcome: move.outcome as object };
      const result = await client.experiment.updateMany({ where: { ...keysOf(move), state: move.fromState }, data: { state: move.toState, ...outcome } });
      return result.count;
    },
    recordExposure: async (exposure) => {
      const stored = await client.exposure.upsert({
        where: { experimentId_visitorKey: { experimentId: exposure.experimentId, visitorKey: exposure.visitorKey } },
        create: { ...keysOf(exposure), visitorKey: exposure.visitorKey, arm: exposure.arm },
        update: {},
      });
      return stored.arm;
    },
    countMetric: async (query) =>
      foldArmCounts(
        await runAsTenant<{ $queryRaw: typeof client.$queryRaw }, Array<{ arm: string; visitors: number; conversions: number }>>({ client, tenantId: query.tenantId, work: (transaction) => transaction.$queryRaw`
          SELECT x.arm, COUNT(*)::int AS visitors,
                 COUNT(*) FILTER (WHERE EXISTS (
                   SELECT 1 FROM telemetry_events e
                   WHERE e.tenant_id = x.tenant_id AND e.visitor_key = x.visitor_key
                     AND e.event_name = ${query.eventName} AND e.occurred_at >= x.exposed_at))::int AS conversions
          FROM exposures x
          WHERE x.tenant_id = ${query.tenantId}::uuid AND x.experiment_id = ${query.experimentId}::uuid
          GROUP BY x.arm` }),
      ),
    disconnect: () => client.$disconnect(),
  };
}
