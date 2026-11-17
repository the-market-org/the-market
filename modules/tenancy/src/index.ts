import { defineModule } from "@the-market/core";
import type { ModuleContext, ServiceMap } from "@the-market/core";
import { buildTenancyDatabase } from "./prisma-tenancy-database.ts";
import { buildTenancyServices, ensureTenant, normaliseHost, resolveTenant } from "./tenancy-services.ts";

export type { TenantRecord } from "./tenancy-services.ts";

/**
 * Composition root of the tenancy module: connects the services to the
 * module's own "tenancy" PostgreSQL schema and nothing else.
 */
export function registerTenancy(context: ModuleContext): ServiceMap {
  const database = buildTenancyDatabase({ databaseUrl: context.databaseUrl });
  return buildTenancyServices({
    database,
    resolve: resolveTenant,
    ensure: ensureTenant,
    normalise: normaliseHost,
  });
}

export const tenancyModule = defineModule({
  name: "tenancy",
  version: "0.0.0",
  schemaName: "tenancy",
  dependsOn: [],
  register: registerTenancy,
});
