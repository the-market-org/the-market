/**
 * The only file in this module that touches Prisma. It implements the
 * TenancyDatabase port, so storage can be replaced here alone.
 */
import { runAsTenant, runWithSettings } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import type { Prisma } from "./generated/client/index.js";
import type { TenancyDatabase } from "./tenancy-services.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildTenancyDatabase(input: {
  databaseUrl: string;
}): TenancyDatabase & { disconnect: () => Promise<void> } {
  const client = new PrismaClient({ datasourceUrl: input.databaseUrl });
  const withSettings = <Result>(settings: Record<string, string>, work: (transaction: Prisma.TransactionClient) => Promise<Result>) => runWithSettings({ client, settings, work });
  return {
    // Before any tenant is known: the policy shows only the row whose host is app.host.
    findTenantByHost: async (query) => (await withSettings({ "app.host": query.host }, (transaction) => transaction.tenant.findUnique({ where: { primaryHost: query.host } }))) ?? undefined,
    findTenantById: async (query) => {
      const tenants = UUID_PATTERN.test(query.tenantId)
        ? await runAsTenant<Prisma.TransactionClient, Awaited<ReturnType<typeof client.tenant.findMany>>>({ client, tenantId: query.tenantId, work: (transaction) => transaction.tenant.findMany({ where: { tenantId: query.tenantId } }) })
        : [];
      return tenants[0];
    },
    findTenantBySlug: async (query) => (await withSettings({ "app.slug": query.slug }, (transaction) => transaction.tenant.findUnique({ where: { slug: query.slug } }))) ?? undefined,
    // Creating a store is allowed only with app.create_store set; app.host makes the new row readable for RETURNING.
    insertTenant: (tenant) =>
      withSettings({ "app.create_store": "yes", "app.host": tenant.primaryHost }, (transaction) =>
        transaction.tenant.create({ data: { slug: tenant.slug, name: tenant.name, primaryHost: tenant.primaryHost } }),
      ),
    disconnect: () => client.$disconnect(),
  };
}
