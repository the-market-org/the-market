import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAppsServices, explainRefusedDecision, requireActiveApp, statusForDecision } from "./apps-services.ts";
import type { AppRecord, AppsDatabase, SlotBinding } from "./apps-types.ts";

function buildFakeDatabase(): AppsDatabase {
  const apps: AppRecord[] = [];
  const bindings: Array<SlotBinding & { tenantId: string }> = [];
  const find = (keys: { tenantId: string; appId: string }) => apps.find((app) => app.tenantId === keys.tenantId && app.appId === keys.appId);
  const sameBinding = (binding: { tenantId: string; appId: string; slotName: string }) => (stored: SlotBinding & { tenantId: string }) =>
    stored.tenantId === binding.tenantId && stored.appId === binding.appId && stored.slotName === binding.slotName;
  return {
    insertApp: async (app) => {
      const record = { ...app, appId: `app_${apps.length + 1}` };
      apps.push(record);
      return record;
    },
    findApp: async (keys) => find(keys),
    findAppByUrl: async (query) => apps.find((app) => app.tenantId === query.tenantId && app.baseUrl === query.baseUrl),
    listApps: async (query) => apps.filter((app) => app.tenantId === query.tenantId),
    updateAppStatus: async (move) => {
      const app = find(move);
      const matches = app?.status === move.fromStatus;
      Object.assign(matches ? (app as AppRecord) : {}, { status: move.toStatus });
      return matches ? 1 : 0;
    },
    setBinding: async (binding) => {
      const app = find(binding) as AppRecord;
      const others = bindings.filter((stored) => !sameBinding(binding)(stored));
      bindings.splice(0, bindings.length, ...others, { ...binding, appName: app.name, rpcUrl: app.rpcUrl });
    },
    findBinding: async (keys) => bindings.find(sameBinding(keys)),
    removeBinding: async (keys) => void bindings.splice(0, bindings.length, ...bindings.filter((stored) => !sameBinding(keys)(stored))),
    listBindings: async (query) => bindings.filter((stored) => stored.tenantId === query.tenantId && stored.slotName === query.slotName),
  };
}

type Services = Record<string, (input: Record<string, unknown>) => Promise<any>>;

function buildServices(): Services {
  return buildAppsServices({ database: buildFakeDatabase(), statusFor: statusForDecision, requireActive: requireActiveApp, explainRefusal: explainRefusedDecision }) as unknown as Services;
}

const reviews = { tenantId: "tenant-a", baseUrl: "https://reviews.example", name: "Reviews", rpcUrl: "https://reviews.example/a2a", slotSkills: ["review-stars"], permissions: [] };

test("an app's first status follows the authoriser, and installing the same address again keeps the first", async () => {
  const services = buildServices();
  assert.deepEqual(["allowed", "refused", "pending"].map(statusForDecision), ["active", "refused", "pending"]);
  const first = await services.registerApp?.({ ...reviews, decision: "pending" });
  const again = await services.registerApp?.({ ...reviews, decision: "allowed" });
  assert.deepEqual([first.status, again.appId, again.status], ["pending", first.appId, "pending"]);
});

test("the owner decides once; a refused app stays refused", async () => {
  const services = buildServices();
  const app = await services.registerApp?.({ ...reviews, decision: "pending" });
  assert.equal((await services.decideApp?.({ tenantId: "tenant-a", appId: app.appId, decision: "refused" })).status, "refused");
  await assert.rejects(services.decideApp?.({ tenantId: "tenant-a", appId: app.appId, decision: "allowed" }) as Promise<unknown>, { message: "App is not waiting for a decision" });
  await assert.rejects(services.decideApp?.({ tenantId: "tenant-a", appId: app.appId, decision: "maybe" }) as Promise<unknown>, { message: "Invalid input: decision must be allowed or refused" });
  await assert.rejects(services.decideApp?.({ tenantId: "tenant-b", appId: app.appId, decision: "allowed" }) as Promise<unknown>, { message: "App not found" });
});

test("only an active app can be bound to a slot", async () => {
  const services = buildServices();
  const app = await services.registerApp?.({ ...reviews, decision: "pending" });
  const binding = { tenantId: "tenant-a", appId: app.appId, slotName: "product.below-detail", skillId: "review-stars", priority: 100 };
  await assert.rejects(services.setBinding?.(binding) as Promise<unknown>, { message: "App is not active" });

  await services.decideApp?.({ tenantId: "tenant-a", appId: app.appId, decision: "allowed" });
  await services.setBinding?.(binding);
  assert.deepEqual((await services.listBindings?.({ tenantId: "tenant-a", slotName: "product.below-detail" })).map((stored: SlotBinding) => stored.skillId), ["review-stars"]);
  await services.removeBinding?.(binding);
  assert.equal(await services.findBinding?.(binding), undefined);
});
