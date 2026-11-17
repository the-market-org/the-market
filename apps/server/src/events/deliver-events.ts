/**
 * Delivers store events to the store's agent connection, signed with HMAC-SHA256.
 * A failure is logged and never thrown: a slow or broken agent never breaks the store.
 */
import { createHmac } from "node:crypto";

export interface DeliveryTarget {
  eventsUrl: string;
  eventNames: string[];
  signingSecret: string;
}

export type PostEvent = (input: { url: string; headers: Record<string, string>; bodyText: string }) => Promise<void>;

/** The signature header value: `sha256=` and the hex HMAC of the exact body. */
export function signEventBody(input: { bodyText: string; signingSecret: string }): string {
  return `sha256=${createHmac("sha256", input.signingSecret).update(input.bodyText).digest("hex")}`;
}

/** The store's connection, when it exists and wants this event. */
export async function findWantedTarget(input: {
  eventName: string;
  tenantId: string;
  findDeliveryTarget: (request: { tenantId: string }) => Promise<DeliveryTarget | undefined>;
}): Promise<DeliveryTarget | undefined> {
  const target = await input.findDeliveryTarget({ tenantId: input.tenantId });
  return target?.eventNames.includes(input.eventName) === true ? target : undefined;
}

/** The tenant an event belongs to, or "" when its payload names none. */
export function readEventTenant(payload: unknown): string {
  const tenantId = (typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {}).tenantId;
  return typeof tenantId === "string" ? tenantId : "";
}

export async function deliverEvent(input: {
  eventName: string;
  payload: unknown;
  readTenant: typeof readEventTenant;
  findTarget: (request: { eventName: string; tenantId: string }) => Promise<DeliveryTarget | undefined>;
  post: PostEvent;
  sign: typeof signEventBody;
  readNow: () => number;
  writeLine: (line: string) => void;
}): Promise<void> {
  const tenantId = input.readTenant(input.payload);
  const target = tenantId === "" ? undefined : await input.findTarget({ eventName: input.eventName, tenantId });
  if (target === undefined) {
    return;
  }
  const bodyText = JSON.stringify({ eventName: input.eventName, tenantId, occurredAt: new Date(input.readNow()).toISOString(), payload: input.payload });
  const headers = { "content-type": "application/json", "x-market-signature": input.sign({ bodyText, signingSecret: target.signingSecret }) };
  await input.post({ url: target.eventsUrl, headers, bodyText }).catch((error: unknown) =>
    input.writeLine(`Event delivery failed: ${input.eventName} to ${new URL(target.eventsUrl).host}: ${(error as Error).message}`),
  );
}
