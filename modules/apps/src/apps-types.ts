/** A third-party app a store has installed. */
export interface AppRecord {
  appId: string;
  tenantId: string;
  baseUrl: string;
  name: string;
  rpcUrl: string;
  slotSkills: string[];
  permissions: string[];
  status: string;
}

/** A binding as the storefront needs it: which active app skill fills a slot, and where to ask. */
export interface SlotBinding {
  appId: string;
  appName: string;
  rpcUrl: string;
  slotName: string;
  skillId: string;
  priority: number;
}

type AppKeys = { tenantId: string; appId: string };
type BindingKeys = AppKeys & { slotName: string };

/** What the services need from storage. The Prisma adapter implements it. */
export interface AppsDatabase {
  insertApp: (input: Omit<AppRecord, "appId">) => Promise<AppRecord>;
  findApp: (input: AppKeys) => Promise<AppRecord | undefined>;
  findAppByUrl: (input: { tenantId: string; baseUrl: string }) => Promise<AppRecord | undefined>;
  listApps: (input: { tenantId: string }) => Promise<AppRecord[]>;
  /** Changes the status only from the stated one. Returns rows changed, 0 or 1. */
  updateAppStatus: (input: AppKeys & { fromStatus: string; toStatus: string }) => Promise<number>;
  setBinding: (input: BindingKeys & { skillId: string; priority: number }) => Promise<void>;
  findBinding: (input: BindingKeys) => Promise<{ skillId: string; priority: number } | undefined>;
  removeBinding: (input: BindingKeys) => Promise<void>;
  /** Bindings of active apps only, lowest priority first. */
  listBindings: (input: { tenantId: string; slotName: string }) => Promise<SlotBinding[]>;
}
