/**
 * Fetches app fragments for a page's slots before the page is sent: every bound app is asked at
 * once, each answer is sanitised, wrapped and capped, and a slow or failing app adds nothing.
 */

type Binding = { appId: string; rpcUrl: string; skillId: string };

export interface SlotSteps {
  listBindings: (input: { tenantId: string; slotName: string }) => Promise<Binding[]>;
  askApp: (input: { rpcUrl: string; skillId: string; slotName: string; pageValues: Record<string, string> }) => Promise<string>;
  clean: (input: { html: string; appId: string }) => string;
  wrap: (input: { slotName: string; appId: string; html: string }) => string;
  limit: (work: Promise<string>) => Promise<string>;
}

const MAX_FRAGMENT_LENGTH = 20000;

/** The first text part of an A2A SendMessage result: a message, or a task's first artifact. */
export function readFragmentText(result: unknown): string {
  const reply = result as { message?: { parts?: Array<{ text?: unknown }> }; task?: { artifacts?: Array<{ parts?: Array<{ text?: unknown }> }> } };
  const parts = reply.message?.parts ?? reply.task?.artifacts?.[0]?.parts ?? [];
  return String(parts.find((part) => typeof part.text === "string")?.text ?? "");
}

async function loadSlot(input: { tenantId: string; slotName: string; pageValues: Record<string, string>; steps: SlotSteps }): Promise<string> {
  const { steps } = input;
  const bindings = await steps.listBindings({ tenantId: input.tenantId, slotName: input.slotName }).catch(() => []);
  const fragments = await Promise.all(
    bindings.map((binding) =>
      steps
        .limit(steps.askApp({ rpcUrl: binding.rpcUrl, skillId: binding.skillId, slotName: input.slotName, pageValues: input.pageValues }))
        .then((html) => steps.wrap({ slotName: input.slotName, appId: binding.appId, html: steps.clean({ html, appId: binding.appId }).slice(0, MAX_FRAGMENT_LENGTH) }))
        .catch(() => ""),
    ),
  );
  return fragments.join("");
}

/** Fragments for every slot a page uses, by slot name. */
export async function loadSlotFragments(input: { tenantId: string; slotNames: string[]; pageValues: Record<string, string>; steps: SlotSteps }): Promise<Record<string, string>> {
  const fragments = await Promise.all(input.slotNames.map((slotName) => loadSlot({ ...input, slotName })));
  return Object.fromEntries(input.slotNames.map((slotName, slotIndex) => [slotName, fragments[slotIndex] ?? ""]));
}
