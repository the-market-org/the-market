/**
 * The only file in this module that touches Prisma. It implements the
 * AppsDatabase port and is the only place that turns a tenant id into a query filter.
 */
import type { AppRecord, AppsDatabase } from "./apps-types.ts";
import { readQueryTenant, scopeToTenant } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function describeApp(stored: AppRecord & { installedAt: Date }): AppRecord {
  const { installedAt: _installedAt, ...app } = stored;
  return app;
}

export function buildAppsDatabase(input: { databaseUrl: string }): AppsDatabase & { disconnect: () => Promise<void> } {
  const client = scopeToTenant({ client: new PrismaClient({ datasourceUrl: input.databaseUrl }), readTenant: readQueryTenant });
  const bindingKey = (keys: { tenantId: string; appId: string; slotName: string }) => ({ tenantId_slotName_appId: { tenantId: keys.tenantId, slotName: keys.slotName, appId: keys.appId } });
  return {
    insertApp: async (app) => describeApp(await client.app.create({ data: app })),
    findApp: async (keys) => (UUID_PATTERN.test(keys.appId) ? (await client.app.findMany({ where: { tenantId: keys.tenantId, appId: keys.appId } })).map(describeApp)[0] : undefined),
    findAppByUrl: async (query) => (await client.app.findMany({ where: query })).map(describeApp)[0],
    listApps: async (query) => (await client.app.findMany({ where: query, orderBy: { installedAt: "asc" } })).map(describeApp),
    updateAppStatus: async (move) => {
      const result = await client.app.updateMany({ where: { tenantId: move.tenantId, appId: move.appId, status: move.fromStatus }, data: { status: move.toStatus } });
      return result.count;
    },
    setBinding: async (binding) => {
      const values = { skillId: binding.skillId, priority: binding.priority };
      await client.appSlotBinding.upsert({ where: bindingKey(binding), create: { tenantId: binding.tenantId, appId: binding.appId, slotName: binding.slotName, ...values }, update: values });
    },
    findBinding: async (keys) => {
      const bindings = await client.appSlotBinding.findMany({ where: { tenantId: keys.tenantId, appId: keys.appId, slotName: keys.slotName } });
      return bindings.map((binding) => ({ skillId: binding.skillId, priority: binding.priority }))[0];
    },
    removeBinding: async (keys) => {
      await client.appSlotBinding.deleteMany({ where: { tenantId: keys.tenantId, appId: keys.appId, slotName: keys.slotName } });
    },
    listBindings: async (query) => {
      const bindings = await client.appSlotBinding.findMany({
        where: { tenantId: query.tenantId, slotName: query.slotName, app: { status: "active" } },
        include: { app: true },
        orderBy: { priority: "asc" },
      });
      return bindings.map((binding) => ({ appId: binding.appId, appName: binding.app.name, rpcUrl: binding.app.rpcUrl, slotName: binding.slotName, skillId: binding.skillId, priority: binding.priority }));
    },
    disconnect: () => client.$disconnect(),
  };
}
