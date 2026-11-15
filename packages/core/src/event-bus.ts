import type { EventHandler } from "./module-types.ts";

export interface EventBus {
  publishEvent: (eventName: string, payload: unknown) => Promise<void>;
  subscribeEvent: (eventName: string, handleEvent: EventHandler) => void;
}

/**
 * In-memory event bus for the prototype.
 * Production swaps this for a transactional outbox behind the same interface.
 */
export function buildEventBus(): EventBus {
  const handlerMap = new Map<string, EventHandler[]>();
  return {
    subscribeEvent: (eventName, handleEvent) => {
      handlerMap.set(eventName, [...(handlerMap.get(eventName) ?? []), handleEvent]);
    },
    publishEvent: async (eventName, payload) => {
      const handlers = handlerMap.get(eventName) ?? [];
      await Promise.all(handlers.map((handleEvent) => handleEvent(payload)));
    },
  };
}
