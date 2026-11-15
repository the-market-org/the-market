/** Page values passed to apps: plain strings only, never internal objects. */
export type PageValues = Record<string, string>;

export type RenderFragment = (pageValues: PageValues) => Promise<string>;

/** One app's contribution to one named slot in a theme template. */
export interface SlotFragment {
  slotName: string;
  appId: string;
  priority: number;
  renderFragment: RenderFragment;
}

/** Returns a new list with the fragment added. The input list is not changed. */
export function addFragment(input: {
  fragments: SlotFragment[];
  slotName: string;
  appId: string;
  priority: number;
  renderFragment: RenderFragment;
}): SlotFragment[] {
  const fragment: SlotFragment = {
    slotName: input.slotName,
    appId: input.appId,
    priority: input.priority,
    renderFragment: input.renderFragment,
  };
  return [...input.fragments, fragment];
}

/** Lists a slot's fragments, lowest priority number first. */
export function listSlotFragments(input: { fragments: SlotFragment[]; slotName: string }): SlotFragment[] {
  return input.fragments
    .filter((fragment) => fragment.slotName === input.slotName)
    .sort((first, second) => first.priority - second.priority);
}
