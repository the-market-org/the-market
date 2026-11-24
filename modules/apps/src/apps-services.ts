import type { ServiceMap } from "@the-market/core";
import type { AppRecord, AppsDatabase } from "./apps-types.ts";

type AppKeys = { tenantId: string; appId: string };
type BindingKeys = AppKeys & { slotName: string };

const DECISION_STATUSES: ReadonlyMap<string, string> = new Map([
  ["allowed", "active"],
  ["refused", "refused"],
  ["pending", "pending"],
]);

/** The status an app starts with, from the app authoriser's answer. */
export function statusForDecision(decision: string): string {
  return DECISION_STATUSES.get(decision) ?? "pending";
}

/** The store's active app, or the reason it cannot be used. */
export async function requireActiveApp(input: AppKeys & { findApp: AppsDatabase["findApp"] }): Promise<AppRecord> {
  const app = await input.findApp({ tenantId: input.tenantId, appId: input.appId });
  if (app === undefined) {
    throw new Error("App not found");
  }
  if (app.status !== "active") {
    throw new Error("App is not active");
  }
  return app;
}

/** Why a decision changed nothing: the app is missing, or not pending. */
export function explainRefusedDecision(app: AppRecord | undefined): string {
  return app === undefined ? "App not found" : "App is not waiting for a decision";
}

/** Builds the apps module's public services over a storage port. */
export function buildAppsServices(input: {
  database: AppsDatabase;
  statusFor: typeof statusForDecision;
  requireActive: typeof requireActiveApp;
  explainRefusal: typeof explainRefusedDecision;
}): ServiceMap {
  const { database } = input;
  return {
    /** Registers an app read from its Agent Card; the same address again returns the app already there. */
    registerApp: async (request: Omit<AppRecord, "appId" | "status"> & { decision: string }) => {
      const { decision, ...app } = request;
      const existing = await database.findAppByUrl({ tenantId: app.tenantId, baseUrl: app.baseUrl });
      return existing ?? database.insertApp({ ...app, status: input.statusFor(decision) });
    },
    /** The store owner's decision on a pending app. */
    decideApp: async (request: AppKeys & { decision: string }) => {
      if (!["allowed", "refused"].includes(request.decision)) {
        throw new Error("Invalid input: decision must be allowed or refused");
      }
      const changed = await database.updateAppStatus({ ...request, fromStatus: "pending", toStatus: input.statusFor(request.decision) });
      const app = await database.findApp(request);
      return changed === 1 ? app : Promise.reject(new Error(input.explainRefusal(app)));
    },
    listApps: (request: { tenantId: string }) => database.listApps(request),
    findApp: (request: AppKeys) => database.findApp(request),
    setBinding: async (request: BindingKeys & { skillId: string; priority: number }) => {
      await input.requireActive({ ...request, findApp: database.findApp });
      await database.setBinding(request);
    },
    findBinding: (request: BindingKeys) => database.findBinding(request),
    removeBinding: (request: BindingKeys) => database.removeBinding(request),
    listBindings: (request: { tenantId: string; slotName: string }) => database.listBindings(request),
  };
}
