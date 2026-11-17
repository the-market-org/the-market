import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTenancyServices, ensureTenant, normaliseHost, resolveTenant } from "./tenancy-services.ts";
import type { TenancyDatabase, TenantRecord } from "./tenancy-services.ts";

interface TenancyServices {
  resolveTenant: (input: { host: string }) => Promise<string | undefined>;
  createTenant: (input: { slug: string; name: string; primaryHost: string }) => Promise<TenantRecord>;
  ensureTenant: (input: { slug: string; name: string; primaryHost: string }) => Promise<TenantRecord>;
}

function buildFakeDatabase(stored: TenantRecord[]): TenancyDatabase {
  return {
    findTenantByHost: async (input) => stored.find((tenant) => tenant.primaryHost === input.host),
    insertTenant: async (input) => {
      const tenant = { ...input, tenantId: `tenant_${stored.length + 1}`, status: "active" };
      stored.push(tenant);
      return tenant;
    },
  };
}

function buildServices(stored: TenantRecord[]): TenancyServices {
  return buildTenancyServices({
    database: buildFakeDatabase(stored),
    resolve: resolveTenant,
    ensure: ensureTenant,
    normalise: normaliseHost,
  }) as unknown as TenancyServices;
}

test("normaliseHost lowercases the host and removes the port", () => {
  assert.equal(normaliseHost("Shop-A.example:3000"), "shop-a.example");
});

test("a created tenant resolves by host whatever the capitals or port", async () => {
  const services = buildServices([]);
  const created = await services.createTenant({
    slug: "shop-a",
    name: "Shop A",
    primaryHost: "Shop-A.example:3000",
  });

  assert.equal(created.primaryHost, "shop-a.example");
  assert.equal(await services.resolveTenant({ host: "SHOP-A.example" }), created.tenantId);
});

test("an unknown host resolves to nothing", async () => {
  assert.equal(await buildServices([]).resolveTenant({ host: "nobody.example" }), undefined);
});

test("a suspended tenant resolves to nothing", async () => {
  const suspended: TenantRecord = {
    tenantId: "tenant_9",
    slug: "closed",
    name: "Closed",
    primaryHost: "closed.example",
    status: "suspended",
  };
  assert.equal(await buildServices([suspended]).resolveTenant({ host: "closed.example" }), undefined);
});

test("ensureTenant returns the existing tenant for a host instead of adding a second", async () => {
  const stored: TenantRecord[] = [];
  const services = buildServices(stored);
  const demo = { slug: "demo", name: "Demo store", primaryHost: "LOCALHOST:3000" };

  const first = await services.ensureTenant(demo);
  const second = await services.ensureTenant(demo);

  assert.equal(second.tenantId, first.tenantId);
  assert.equal(stored.length, 1);
  assert.equal(first.primaryHost, "localhost");
});
