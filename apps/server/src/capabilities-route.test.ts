import assert from "node:assert/strict";
import { test } from "node:test";
import type { CapabilityDefinition } from "@the-market/core";
import { composeServer } from "./compose.ts";

function buildCapability(name: string): CapabilityDefinition {
  return {
    name,
    summary: `Summary of ${name}`,
    inputSchema: { type: "object", required: ["productId"], properties: { productId: { type: "string" } } },
    risk: "low",
    buildChange: async () => ({ capabilityName: name, tenantId: "", summary: "", change: null, revert: null }),
    applyChange: async () => {},
    revertChange: async () => {},
  };
}

const fakeRegistry = {
  tenancy: { resolveTenant: async () => undefined },
  catalog: { listProducts: async () => [] },
};

test("GET /api/capabilities lists each capability's public fields, sorted by name", async () => {
  const app = await composeServer({
    readUptime: () => 0,
    registry: fakeRegistry,
    capabilities: {
      "catalog.product.rename": buildCapability("catalog.product.rename"),
      "catalog.product.archive": buildCapability("catalog.product.archive"),
    },
  });

  const response = await app.request("/api/capabilities");
  const body = (await response.json()) as { capabilities: Array<Record<string, unknown>> };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.deepEqual(
    body.capabilities.map((capability) => capability.name),
    ["catalog.product.archive", "catalog.product.rename"],
  );
  assert.deepEqual(Object.keys(body.capabilities[1] ?? {}), ["name", "summary", "inputSchema", "risk"]);
  assert.deepEqual(body.capabilities[1], {
    name: "catalog.product.rename",
    summary: "Summary of catalog.product.rename",
    inputSchema: { type: "object", required: ["productId"], properties: { productId: { type: "string" } } },
    risk: "low",
  });
});

test("GET /api/capabilities answers without a store host", async () => {
  const app = await composeServer({ readUptime: () => 0, registry: fakeRegistry, capabilities: {} });

  const response = await app.request("http://nobody.example/api/capabilities");

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '{"capabilities":[]}');
});
