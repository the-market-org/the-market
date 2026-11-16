/** Public services a module exposes, keyed by service name. */
export type ServiceMap = Record<string, unknown>;

/** Every loaded module's services, keyed by module name. */
export type ModuleRegistry = Record<string, ServiceMap>;

export type EventHandler = (payload: unknown) => Promise<void> | void;

/**
 * The only things a module receives from the platform.
 * A module never receives another module's services: it talks to the rest
 * of the system through events, and workflows compose modules from outside.
 */
export interface ModuleContext {
  moduleName: string;
  schemaName: string;
  /** Database URL already pointed at this module's own schema. */
  databaseUrl: string;
  publishEvent: (eventName: string, payload: unknown) => Promise<void>;
  subscribeEvent: (eventName: string, handleEvent: EventHandler) => void;
}

export interface ModuleDefinition {
  /** Unique module name, for example "catalog". */
  name: string;
  version: string;
  /** PostgreSQL schema this module owns. No other module may touch it. */
  schemaName: string;
  /** Modules that must be loaded first (their events must exist). */
  dependsOn: string[];
  register: (context: ModuleContext) => Promise<ServiceMap> | ServiceMap;
}

export type BuildContext = (input: { moduleName: string; schemaName: string }) => ModuleContext;
