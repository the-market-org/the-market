import type { HttpReply } from "@the-market/core";
import type { PageValues, SlotFragment } from "./slot-registry.ts";

const SAFE_NAME = /^[a-z0-9][a-z0-9.-]*$/;

export function isSafeName(candidate: string): boolean {
  return SAFE_NAME.test(candidate);
}

/** Wraps a cleaned fragment so themes and htmx can target it by id. */
export function wrapFragment(input: { slotName: string; appId: string; html: string }): string {
  const elementId = `slot-${input.slotName.replaceAll(".", "-")}-${input.appId}`;
  return `<div id="${elementId}" data-slot="${input.slotName}" data-app="${input.appId}">${input.html}</div>`;
}

/** Fails a fragment render that takes longer than the time budget. */
export function limitDuration(input: {
  work: Promise<string>;
  timeoutMs: number;
  startTimer: (callback: () => void, durationMs: number) => void;
}): Promise<string> {
  const deadline = new Promise<string>((_resolve, reject) => {
    input.startTimer(() => reject(new Error("Fragment timed out")), input.timeoutMs);
  });
  return Promise.race([input.work, deadline]);
}

/**
 * Renders every app fragment registered for a slot.
 * A fragment that throws or times out is dropped: one bad app never
 * breaks the page or delays the other fragments.
 */
export async function renderSlot(input: {
  slotName: string;
  pageValues: PageValues;
  slotFragments: SlotFragment[];
  limitRender: (work: Promise<string>) => Promise<string>;
  cleanHtml: (input: { html: string; appId: string }) => string;
  wrapHtml: (input: { slotName: string; appId: string; html: string }) => string;
}): Promise<string> {
  const outcomes = await Promise.allSettled(
    input.slotFragments.map((fragment) => input.limitRender(fragment.renderFragment(input.pageValues))),
  );
  return input.slotFragments
    .map((fragment, position) => {
      const outcome = outcomes[position] as PromiseSettledResult<string>;
      return outcome.status === "fulfilled"
        ? input.wrapHtml({
            slotName: input.slotName,
            appId: fragment.appId,
            html: input.cleanHtml({ html: outcome.value, appId: fragment.appId }),
          })
        : "";
    })
    .join("");
}

/** What a theme template prints where apps may inject: a lazy htmx placeholder. */
export function renderSlotPlaceholder(input: { slotName: string; queryString: string }): string {
  const partialUrl = `/partials/slots/${input.slotName}?${input.queryString}`;
  return `<div hx-get="${partialUrl}" hx-trigger="load" hx-swap="outerHTML"></div>`;
}

/** HTTP handler for GET /partials/slots/:slotName, framework independent. */
export async function handleSlotPartial(input: {
  slotName: string;
  pageValues: PageValues;
  checkName: (candidate: string) => boolean;
  renderSlotHtml: (input: { slotName: string; pageValues: PageValues }) => Promise<string>;
}): Promise<HttpReply> {
  if (!input.checkName(input.slotName)) {
    return { status: 400, headers: { "content-type": "text/plain" }, bodyText: "Invalid slot name" };
  }
  const bodyText = await input.renderSlotHtml({ slotName: input.slotName, pageValues: input.pageValues });
  return { status: 200, headers: { "content-type": "text/html; charset=utf-8", vary: "HX-Request" }, bodyText };
}
