/**
 * The only file in this module that touches Prisma. It implements the
 * TenancyDatabase port, so storage can be replaced here alone.
 */
import { PrismaClient } from "./generated/client/index.js";
import type { TenancyDatabase } from "./tenancy-services.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildTenancyDatabase(input: {
  databaseUrl: string;
}): TenancyDatabase & { disconnect: () => Promise<void> } {
  const client = new PrismaClient({ datasourceUrl: input.databaseUrl });
  return {
    findTenantByHost: async (query) => {
      const tenant = await client.tenant.findUnique({ where: { primaryHost: query.host } });
      return tenant ?? undefined;
    },
    findTenantById: async (query) => {
      const tenants = UUID_PATTERN.test(query.tenantId)
        ? await client.tenant.findMany({ where: { tenantId: query.tenantId } })
        : [];
      return tenants[0];
    },
    findTenantBySlug: async (query) => (await client.tenant.findUnique({ where: { slug: query.slug } })) ?? undefined,
    insertTenant: (tenant) =>
      client.tenant.create({
        data: { slug: tenant.slug, name: tenant.name, primaryHost: tenant.primaryHost },
      }),
    disconnect: () => client.$disconnect(),
  };
}
