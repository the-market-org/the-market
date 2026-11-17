import assert from "node:assert/strict";
import { test } from "node:test";
import { addCapability, collectCapabilities, listDeclaredCapabilities } from "./capability-registry.ts";
import type { CapabilityDefinition } from "./capability-types.ts";
import type { ModuleDefinition } from "./module-types.ts";

function buildCapability(name: string): CapabilityDefinition {
  return {
    name,
    summary: `Test capability ${name}`,
    inputSchema: { type: "object" },
    risk: "low",
    buildChange: async (request) => ({
      capabilityName: name,
      tenantId: request.tenantId,
      summary: "nothing",
      change: null,
      revert: null,
    }),
    applyChange: async () => {},
    revertChange: async () => {},
  };
}

function buildModule(input: { name: string; capabilityNames?: string[] }): ModuleDefinition {
  const capabilityNames = input.capabilityNames;
  return {
    name: input.name,
    version: "0.0.0",
    schemaName: input.name,
    dependsOn: [],
    register: () => ({}),
    ...(capabilityNames ? { listCapabilities: () => capabilityNames.map(buildCapability) } : {}),
  };
}

function collect(definitions: ModuleDefinition[]) {
  return collectCapabilities({
    definitions,
    registry: {},
    listDeclared: listDeclaredCapabilities,
    addOne: addCapability,
  });
}

test("a module's capability is collected under its name", () => {
  const capabilities = collect([buildModule({ name: "catalog", capabilityNames: ["catalog.product.rename"] })]);

  assert.deepEqual(Object.keys(capabilities), ["catalog.product.rename"]);
  assert.equal(capabilities["catalog.product.rename"]?.risk, "low");
});

test("a module without listCapabilities contributes nothing", () => {
  assert.deepEqual(collect([buildModule({ name: "tenancy" })]), {});
});

test("the same capability name from two modules fails", () => {
  assert.throws(
    () =>
      collect([
        buildModule({ name: "catalog", capabilityNames: ["catalog.product.rename"] }),
        buildModule({ name: "catalog", capabilityNames: ["catalog.product.rename"] }),
      ]),
    { message: 'Capability "catalog.product.rename" is declared twice' },
  );
});

test("a capability named after another module fails", () => {
  assert.throws(() => collect([buildModule({ name: "catalog", capabilityNames: ["orders.order.cancel"] })]), {
    message: 'Capability "orders.order.cancel" must start with "catalog."',
  });
});

test("listCapabilities receives the module's own services", () => {
  const receivedServices: unknown[] = [];
  const definition: ModuleDefinition = {
    ...buildModule({ name: "catalog" }),
    listCapabilities: (request) => {
      receivedServices.push(request.services);
      return [];
    },
  };
  const catalogServices = { listProducts: async () => [] };

  collectCapabilities({
    definitions: [definition],
    registry: { catalog: catalogServices },
    listDeclared: listDeclaredCapabilities,
    addOne: addCapability,
  });

  assert.deepEqual(receivedServices, [catalogServices]);
});
