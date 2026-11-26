/**
 * Composition of event delivery: listens on the event bus and delivers each store event
 * to its agent connection. Delivery is not awaited, because the event bus waits for its
 * handlers and a slow agent must never slow the store.
 */
import { resolveService } from "@the-market/core";
import type { EventHandler, ModuleRegistry } from "@the-market/core";
import { deliverEvent, findWantedTarget, readEventTenant, signEventBody } from "./deliver-events.ts";
import type { DeliveryTarget, PostEvent } from "./deliver-events.ts";

export const DELIVERED_EVENTS: readonly string[] = Object.freeze(["catalog.product.created", "changes.change-set.moved", "orders.order.paid", "merchant.message.sent"]);

export function composeEventDelivery(input: {
  registry: ModuleRegistry;
  subscribeEvent: (eventName: string, handleEvent: EventHandler) => void;
  post: PostEvent;
  readNow: () => number;
  writeLine: (line: string) => void;
}): void {
  const findDeliveryTarget = resolveService({ registry: input.registry, moduleName: "connections", serviceName: "findDeliveryTarget" }) as (request: { tenantId: string }) => Promise<DeliveryTarget | undefined>;
  for (const eventName of DELIVERED_EVENTS) {
    input.subscribeEvent(eventName, (payload) => {
      void deliverEvent({
        eventName,
        payload,
        readTenant: readEventTenant,
        findTarget: (request) => findWantedTarget({ ...request, findDeliveryTarget }),
        post: input.post,
        sign: signEventBody,
        readNow: input.readNow,
        writeLine: input.writeLine,
      }).catch((error: unknown) => input.writeLine(`Event delivery failed: ${eventName}: ${(error as Error).message}`));
    });
  }
}

/** Posts one event with `fetch`, failing after five seconds or on any status other than 2xx. */
export async function postWithFetch(input: { url: string; headers: Record<string, string>; bodyText: string }): Promise<void> {
  const response = await fetch(input.url, { method: "POST", headers: input.headers, body: input.bodyText, signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`status ${response.status}`);
  }
}
