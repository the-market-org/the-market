/**
 * Composition root: the one place in this package that wires concrete
 * functions together. Everything else receives its collaborators as parameters.
 */
import type { HttpReply } from "@the-market/core";
import { cleanFragment, scopeHtmxRequests, stripActiveContent } from "./fragment-sanitizer.ts";
import { handleSlotPartial, isSafeName, limitDuration, renderSlot, wrapFragment } from "./partial-handler.ts";
import { listSlotFragments } from "./slot-registry.ts";
import type { PageValues, SlotFragment } from "./slot-registry.ts";

export type SlotPartialHandler = (input: { slotName: string; pageValues: PageValues }) => Promise<HttpReply>;

export function composeSlotHandler(input: {
  fragments: SlotFragment[];
  timeoutMs: number;
  startTimer: (callback: () => void, durationMs: number) => void;
}): SlotPartialHandler {
  return (request) =>
    handleSlotPartial({
      slotName: request.slotName,
      pageValues: request.pageValues,
      checkName: isSafeName,
      renderSlotHtml: (slot) =>
        renderSlot({
          slotName: slot.slotName,
          pageValues: slot.pageValues,
          slotFragments: listSlotFragments({ fragments: input.fragments, slotName: slot.slotName }),
          limitRender: (work) => limitDuration({ work, timeoutMs: input.timeoutMs, startTimer: input.startTimer }),
          cleanHtml: (fragment) =>
            cleanFragment({ ...fragment, stripContent: stripActiveContent, scopeRequests: scopeHtmxRequests }),
          wrapHtml: wrapFragment,
        }),
    });
}
