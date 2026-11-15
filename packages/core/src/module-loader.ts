import type { BuildContext, ModuleDefinition, ModuleRegistry, ServiceMap } from "./module-types.ts";

type DependencyMap = Record<string, string[]>;

type FindReady = (input: {
  pendingNames: string[];
  loadedNames: string[];
  dependencyMap: DependencyMap;
}) => string[];

type OrderNames = (input: { dependencyMap: DependencyMap; findReady: FindReady }) => string[];

/** Declares a module. Freezing stops later code from mutating the definition. */
export function defineModule(definition: ModuleDefinition): ModuleDefinition {
  return Object.freeze({ ...definition, dependsOn: [...definition.dependsOn] });
}

/** Lists pending modules whose dependencies are all loaded already. */
export function findReadyNames(input: {
  pendingNames: string[];
  loadedNames: string[];
  dependencyMap: DependencyMap;
}): string[] {
  return input.pendingNames.filter((moduleName) =>
    (input.dependencyMap[moduleName] ?? []).every((dependencyName) =>
      input.loadedNames.includes(dependencyName),
    ),
  );
}

/** Orders module names so every module comes after the modules it depends on. */
export function orderModuleNames(input: { dependencyMap: DependencyMap; findReady: FindReady }): string[] {
  const orderedNames: string[] = [];
  let pendingNames = Object.keys(input.dependencyMap);
  while (pendingNames.length > 0) {
    const readyNames = input.findReady({
      pendingNames,
      loadedNames: orderedNames,
      dependencyMap: input.dependencyMap,
    });
    if (readyNames.length === 0) {
      throw new Error(`Circular or missing module dependency among: ${pendingNames.join(", ")}`);
    }
    orderedNames.push(...readyNames);
    pendingNames = pendingNames.filter((moduleName) => !readyNames.includes(moduleName));
  }
  return orderedNames;
}

/** Registers every module in dependency order and returns the service registry. */
export async function loadModules(input: {
  definitions: ModuleDefinition[];
  buildContext: BuildContext;
  orderNames: OrderNames;
  findReady: FindReady;
}): Promise<ModuleRegistry> {
  const definitionMap = new Map(input.definitions.map((definition) => [definition.name, definition]));
  const dependencyMap = Object.fromEntries(
    input.definitions.map((definition) => [definition.name, definition.dependsOn]),
  );
  const orderedNames = input.orderNames({ dependencyMap, findReady: input.findReady });
  const serviceEntries: Array<[string, ServiceMap]> = [];
  for (const moduleName of orderedNames) {
    const definition = definitionMap.get(moduleName) as ModuleDefinition;
    const context = input.buildContext({ moduleName, schemaName: definition.schemaName });
    serviceEntries.push([moduleName, await definition.register(context)]);
  }
  return Object.fromEntries(serviceEntries);
}

/** Looks a service up for a workflow. Modules themselves never call this. */
export function resolveService(input: {
  registry: ModuleRegistry;
  moduleName: string;
  serviceName: string;
}): unknown {
  const service = input.registry[input.moduleName]?.[input.serviceName];
  if (service === undefined) {
    throw new Error(`Service "${input.serviceName}" is not registered by module "${input.moduleName}"`);
  }
  return service;
}
