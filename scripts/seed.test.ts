import assert from "node:assert/strict";
import { test } from "node:test";
import { readDatabaseUrl, runSeed, slugForHost } from "./seed.ts";

test("a missing database URL stops with a message saying where to set it", () => {
  assert.throws(() => readDatabaseUrl(undefined), {
    message: "DATABASE_URL is not set. Add it to .env in the repository root.",
  });
});

test("runSeed seeds the demo tenant for the host and reports the count", async () => {
  const tenantRequests: Array<{ slug: string; name: string; primaryHost: string }> = [];
  const seededTenants: string[] = [];
  const writtenLines: string[] = [];

  await runSeed({
    storeHost: "localhost",
    slugFor: slugForHost,
    ensureTenant: async (tenant) => {
      tenantRequests.push(tenant);
      return { tenantId: "tenant-demo" };
    },
    seedProducts: async (request) => {
      seededTenants.push(request.tenantId);
      return 6;
    },
    writeLine: (line) => writtenLines.push(line),
  });

  assert.deepEqual(tenantRequests, [{ slug: "demo", name: "Demo store", primaryHost: "localhost" }]);
  assert.deepEqual(seededTenants, ["tenant-demo"]);
  assert.deepEqual(writtenLines, ["Seeded 6 products for localhost"]);
});

test("each host gets its own slug, so a second store can be seeded", () => {
  assert.deepEqual(["localhost", "shop-b.localhost", "Leads.Example.com"].map(slugForHost), ["demo", "shop-b-localhost", "leads-example-com"]);
});
