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
  findTenantById: (input: { tenantId: string }) => Promise<TenantRecord | undefined>;
  findTenantBySlug: (input: { slug: string }) => Promise<TenantRecord | undefined>;
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

/** Returns the tenant that owns a host name, creating it only when none exists. */
export async function ensureTenant(input: {
  slug: string;
  name: string;
  primaryHost: string;
  findTenantByHost: TenancyDatabase["findTenantByHost"];
  insertTenant: TenancyDatabase["insertTenant"];
  normalise: (host: string) => string;
}): Promise<TenantRecord> {
  const primaryHost = input.normalise(input.primaryHost);
  const existing = await input.findTenantByHost({ host: primaryHost });
  return existing ?? input.insertTenant({ slug: input.slug, name: input.name, primaryHost });
}

const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;

/** Refuses a slug that is not 3 to 40 lower-case letters, digits or hyphens. */
export function checkSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error("Invalid input: slug must be 3 to 40 lower-case letters, digits or hyphens");
  }
}

/** Refuses a host or slug another store already has; never hands back that store. */
export function checkFree(input: { hostOwner: TenantRecord | undefined; slugOwner: TenantRecord | undefined }): void {
  if (input.hostOwner !== undefined) {
    throw new Error("Host is already used");
  }
  if (input.slugOwner !== undefined) {
    throw new Error("Slug is already used");
  }
}

/** Creates a new store for a publisher: a valid slug, and a host and slug no other store has. */
export async function createStore(input: {
  slug: string;
  name: string;
  primaryHost: string;
  database: TenancyDatabase;
  normalise: (host: string) => string;
}): Promise<TenantRecord> {
  checkSlug(input.slug);
  const primaryHost = input.normalise(input.primaryHost);
  const [hostOwner, slugOwner] = await Promise.all([input.database.findTenantByHost({ host: primaryHost }), input.database.findTenantBySlug({ slug: input.slug })]);
  checkFree({ hostOwner, slugOwner });
  return input.database.insertTenant({ slug: input.slug, name: input.name, primaryHost });
}

/** Builds the tenancy module's public services over a storage port. */
export function buildTenancyServices(input: {
  database: TenancyDatabase;
  resolve: typeof resolveTenant;
  ensure: typeof ensureTenant;
  normalise: typeof normaliseHost;
  create: typeof createStore;
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
    createStore: (store: { slug: string; name: string; primaryHost: string }) =>
      input.create({ slug: store.slug, name: store.name, primaryHost: store.primaryHost, database: input.database, normalise: input.normalise }),
    findTenant: (request: { tenantId: string }) => input.database.findTenantById({ tenantId: request.tenantId }),
    ensureTenant: (tenant: { slug: string; name: string; primaryHost: string }) =>
      input.ensure({
        ...tenant,
        findTenantByHost: input.database.findTenantByHost,
        insertTenant: input.database.insertTenant,
        normalise: input.normalise,
      }),
  };
}
