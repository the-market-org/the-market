/** `apps.slot.bind`: shows an active app's skill in a storefront slot, and can put the previous binding back. */
import type { CapabilityDefinition } from "@the-market/core";

/** The storefront slots apps can fill. */
export const SLOT_NAMES: readonly string[] = Object.freeze(["product.below-detail", "home.below-hero"]);

type BindingKeys = { tenantId: string; appId: string; slotName: string };
type Binding = { skillId: string; priority: number };

interface AppServices {
  findApp: (input: { tenantId: string; appId: string }) => Promise<{ name: string; status: string; slotSkills: string[] } | undefined>;
  findBinding: (input: BindingKeys) => Promise<Binding | undefined>;
  setBinding: (input: BindingKeys & Binding) => Promise<void>;
  removeBinding: (input: BindingKeys) => Promise<void>;
}

const BIND_SCHEMA: Record<string, unknown> = Object.freeze({
  type: "object",
  required: ["appId", "skillId", "slotName"],
  properties: { appId: { type: "string" }, skillId: { type: "string" }, slotName: { type: "string" }, priority: { type: "number" } },
});

/** Refuses a slot the storefront does not have. */
export function checkSlotName(slotName: string): void {
  if (!SLOT_NAMES.includes(slotName)) {
    throw new Error(`Unknown slot: ${slotName}`);
  }
}

/** The app, when it exists and is active. */
export function requireActive(app: { name: string; status: string; slotSkills: string[] } | undefined) {
  if (app === undefined) {
    throw new Error("App not found");
  }
  if (app.status !== "active") {
    throw new Error("App is not active");
  }
  return app;
}

/** Refuses a skill the app does not offer for slots. */
export function checkOffersSkill(input: { slotSkills: string[]; skillId: string }): void {
  if (!input.slotSkills.includes(input.skillId)) {
    throw new Error(`The app does not offer ${input.skillId}`);
  }
}

export function buildSlotBindCapability(input: AppServices): CapabilityDefinition {
  const capabilityName = "apps.slot.bind";
  return {
    name: capabilityName,
    summary: "Show an app in a storefront slot",
    inputSchema: BIND_SCHEMA,
    risk: "medium",
    buildChange: async (request) => {
      const candidate = request.candidate as { appId: string; skillId: string; slotName: string; priority?: number };
      checkSlotName(candidate.slotName);
      const app = requireActive(await input.findApp({ tenantId: request.tenantId, appId: candidate.appId }));
      checkOffersSkill({ slotSkills: app.slotSkills, skillId: candidate.skillId });
      const keys = { appId: candidate.appId, slotName: candidate.slotName };
      const previous = await input.findBinding({ tenantId: request.tenantId, ...keys });
      return {
        capabilityName,
        tenantId: request.tenantId,
        summary: `Show ${app.name} in ${candidate.slotName}`,
        change: { ...keys, skillId: candidate.skillId, priority: candidate.priority ?? 100 },
        revert: previous === undefined ? { ...keys, remove: true } : { ...keys, ...previous },
      };
    },
    applyChange: (request) => input.setBinding({ tenantId: request.tenantId, ...(request.change as Omit<BindingKeys, "tenantId"> & Binding) }),
    revertChange: (request) => {
      const revert = request.revert as Omit<BindingKeys, "tenantId"> & Partial<Binding> & { remove?: boolean };
      return revert.remove === true
        ? input.removeBinding({ tenantId: request.tenantId, appId: revert.appId, slotName: revert.slotName })
        : input.setBinding({ tenantId: request.tenantId, appId: revert.appId, slotName: revert.slotName, skillId: String(revert.skillId), priority: Number(revert.priority) });
    },
  };
}
