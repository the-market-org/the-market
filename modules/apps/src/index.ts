import { defineModule } from "@the-market/core";
import type { ServiceMap } from "@the-market/core";

export type { AppRecord, AppsDatabase, SlotBinding } from "./apps-types.ts";

/**
 * Composition root of the apps module. Its services arrive in a later task;
 * for now it only claims the "apps" PostgreSQL schema.
 */
export function registerApps(): ServiceMap {
  return {};
}

export const appsModule = defineModule({
  name: "apps",
  version: "0.0.0",
  schemaName: "apps",
  dependsOn: [],
  register: registerApps,
});
