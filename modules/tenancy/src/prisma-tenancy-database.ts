/**
 * The only file in this module that touches Prisma. It implements the
 * TenancyDatabase port, so storage can be replaced here alone.
 */
import { PrismaClient } from "./generated/client/index.js";
import type { TenancyDatabase } from "./tenancy-services.ts";

export function buildTenancyDatabase(input: {
  databaseUrl: string;
}): TenancyDatabase & { disconnect: () => Promise<void> } {
  const client = new PrismaClient({ datasourceUrl: input.databaseUrl });
  return {
    findTenantByHost: async (query) => {
      const tenant = await client.tenant.findUnique({ where: { primaryHost: query.host } });
      return tenant ?? undefined;
    },
    insertTenant: (tenant) =>
      client.tenant.create({
        data: { slug: tenant.slug, name: tenant.name, primaryHost: tenant.primaryHost },
      }),
    disconnect: () => client.$disconnect(),
  };
}
