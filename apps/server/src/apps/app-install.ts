/** Installing an app: read its Agent Card, check its addresses, ask the app authoriser, register it. */
import { selectJsonRpcUrl } from "@the-market/a2a-gateway";
import type { AgentCard } from "@the-market/a2a-gateway";
import type { AppDecision } from "@the-market/sockets";

type NewApp = { tenantId: string; baseUrl: string; name: string; rpcUrl: string; slotSkills: string[]; permissions: string[]; decision: AppDecision };

/** The ids of the skills an app offers for storefront slots. */
export function readSlotSkills(card: AgentCard): string[] {
  return card.skills.filter((skill) => skill.tags.includes("storefront-slot")).map((skill) => skill.id);
}

export async function installApp(input: {
  tenantId: string;
  baseUrl: string;
  permissions: string[];
  checkAddress: (address: string) => Promise<void>;
  discover: (baseUrl: string) => Promise<AgentCard>;
  decide: (request: { tenantId: string; appUrl: string; permissions: string[] }) => Promise<AppDecision>;
  register: (app: NewApp) => Promise<{ appId: string; status: string }>;
  readSkills: typeof readSlotSkills;
}): Promise<{ appId: string; status: string }> {
  await input.checkAddress(input.baseUrl);
  const card = await input.discover(input.baseUrl);
  const rpcUrl = selectJsonRpcUrl(card.supportedInterfaces);
  await input.checkAddress(rpcUrl);
  const slotSkills = input.readSkills(card);
  if (slotSkills.length === 0) {
    throw new Error("The app offers no storefront slots");
  }
  const decision = await input.decide({ tenantId: input.tenantId, appUrl: input.baseUrl, permissions: input.permissions });
  return input.register({ tenantId: input.tenantId, baseUrl: input.baseUrl, name: card.name, rpcUrl, slotSkills, permissions: input.permissions, decision });
}
