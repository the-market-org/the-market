import { defineModule } from "@the-market/core";
import type { ModuleContext, ServiceMap } from "@the-market/core";
import { isAllowedMove } from "./change-set-states.ts";
import { addChangeItem, buildChangesServices } from "./changes-services.ts";
import { explainRefusedMove, moveChangeSet } from "./move-change-set.ts";
import { buildChangesDatabase } from "./prisma-changes-database.ts";

export type { ChangeItemRecord, ChangeSetRecord, ChangesDatabase } from "./changes-types.ts";

/**
 * Composition root of the changes module: connects the services to the
 * module's own "changes" PostgreSQL schema and nothing else.
 */
export function registerChanges(context: ModuleContext): ServiceMap {
  return buildChangesServices({
    database: buildChangesDatabase({ databaseUrl: context.databaseUrl }),
    addOne: addChangeItem,
    moveOne: moveChangeSet,
    isAllowed: isAllowedMove,
    explainRefusal: explainRefusedMove,
    publishEvent: context.publishEvent,
  });
}

export const changesModule = defineModule({
  name: "changes",
  version: "0.0.0",
  schemaName: "changes",
  dependsOn: [],
  register: registerChanges,
});
