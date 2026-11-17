import type { CapabilityDefinition, CapabilityRegistry } from "./capability-types.ts";
import type { ModuleDefinition, ModuleRegistry, ServiceMap } from "./module-types.ts";

/** Asks one module for its capabilities. A module without listCapabilities declares none. */
export function listDeclaredCapabilities(input: {
  listCapabilities: ModuleDefinition["listCapabilities"];
  services: ServiceMap;
}): CapabilityDefinition[] {
  return input.listCapabilities?.({ services: input.services }) ?? [];
}

/** Adds one capability, refusing names outside the module and names already taken. */
export function addCapability(input: {
  collected: CapabilityRegistry;
  moduleName: string;
  capability: CapabilityDefinition;
}): CapabilityRegistry {
  const capabilityName = input.capability.name;
  if (!capabilityName.startsWith(`${input.moduleName}.`)) {
    throw new Error(`Capability "${capabilityName}" must start with "${input.moduleName}."`);
  }
  if (Object.hasOwn(input.collected, capabilityName)) {
    throw new Error(`Capability "${capabilityName}" is declared twice`);
  }
  return { ...input.collected, [capabilityName]: input.capability };
}

/** Collects the capabilities of every loaded module into one registry. */
export function collectCapabilities(input: {
  definitions: ModuleDefinition[];
  registry: ModuleRegistry;
  listDeclared: typeof listDeclaredCapabilities;
  addOne: typeof addCapability;
}): CapabilityRegistry {
  return input.definitions
    .flatMap((definition) =>
      input
        .listDeclared({ listCapabilities: definition.listCapabilities, services: input.registry[definition.name] ?? {} })
        .map((capability) => ({ moduleName: definition.name, capability })),
    )
    .reduce<CapabilityRegistry>((collected, entry) => input.addOne({ collected, ...entry }), {});
}
