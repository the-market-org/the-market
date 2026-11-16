import type { ServiceMap } from "@the-market/core";

/** One store. The `tenant` table holds one row per tenant. */
export interface TenantRecord {
  tenantId: string;
  slug: string;
  name: string;
  primaryHost: string;
  status: string;
}

/** What the services need from storage. The Prisma adapter implements it. */
export interface TenancyDatabase {
  findTenantByHost: (input: { host: string }) => Promise<TenantRecord | undefined>;
  insertTenant: (input: { slug: string; name: string; primaryHost: string }) => Promise<TenantRecord>;
}

/** Lowercases a host name and removes any port, so lookups are consistent. */
export function normaliseHost(host: string): string {
  return host.trim().toLowerCase().split(":")[0] as string;
}

/** Finds the active tenant that owns a host name. Returns its tenant id. */
export async function resolveTenant(input: {
  host: string;
  findTenantByHost: TenancyDatabase["findTenantByHost"];
  normalise: (host: string) => string;
}): Promise<string | undefined> {
  const tenant = await input.findTenantByHost({ host: input.normalise(input.host) });
  return tenant?.status === "active" ? tenant.tenantId : undefined;
}

/** Builds the tenancy module's public services over a storage port. */
export function buildTenancyServices(input: {
  database: TenancyDatabase;
  resolve: typeof resolveTenant;
  normalise: typeof normaliseHost;
}): ServiceMap {
  return {
    resolveTenant: (request: { host: string }) =>
      input.resolve({
        host: request.host,
        findTenantByHost: input.database.findTenantByHost,
        normalise: input.normalise,
      }),
    createTenant: (tenant: { slug: string; name: string; primaryHost: string }) =>
      input.database.insertTenant({
        slug: tenant.slug,
        name: tenant.name,
        primaryHost: input.normalise(tenant.primaryHost),
      }),
  };
}
