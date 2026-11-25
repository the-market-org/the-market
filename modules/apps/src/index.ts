import { defineModule } from "@the-market/core";
import type { ModuleContext, ServiceMap } from "@the-market/core";
import { SLOT_NAMES, buildSlotBindCapability } from "./apps-capabilities.ts";
import { buildAppsServices, explainRefusedDecision, requireActiveApp, statusForDecision } from "./apps-services.ts";
import { buildAppsDatabase } from "./prisma-apps-database.ts";

export type { AppRecord, AppsDatabase, SlotBinding } from "./apps-types.ts";
export { SLOT_NAMES };

/**
 * Composition root of the apps module: connects the services to the
 * module's own "apps" PostgreSQL schema and nothing else.
 */
export function registerApps(context: ModuleContext): ServiceMap {
  return buildAppsServices({ database: buildAppsDatabase({ databaseUrl: context.databaseUrl }), statusFor: statusForDecision, requireActive: requireActiveApp, explainRefusal: explainRefusedDecision });
}

export const appsModule = defineModule({
  name: "apps",
  version: "0.0.0",
  schemaName: "apps",
  dependsOn: [],
  register: registerApps,
  listCapabilities: (request) => [buildSlotBindCapability(request.services as unknown as Parameters<typeof buildSlotBindCapability>[0])],
});
