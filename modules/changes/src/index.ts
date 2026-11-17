import { defineModule } from "@the-market/core";
import type { ServiceMap } from "@the-market/core";

export type { ChangeItemRecord, ChangeSetRecord, ChangesDatabase } from "./changes-types.ts";

/**
 * Composition root of the changes module. Its services arrive in the next task;
 * for now it only claims the "changes" PostgreSQL schema.
 */
export function registerChanges(): ServiceMap {
  return {};
}

export const changesModule = defineModule({
  name: "changes",
  version: "0.0.0",
  schemaName: "changes",
  dependsOn: [],
  register: registerChanges,
});
