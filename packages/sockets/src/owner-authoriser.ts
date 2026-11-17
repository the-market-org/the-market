/**
 * Default app authoriser for a self-hosted store: the store's owner decides.
 * Nothing is allowed without a recorded decision, and a decision covers only the
 * permissions that were asked for when it was made. Kept in memory until work package 10 stores it.
 */
import type { AppAuthoriser, AppDecision } from "./socket-types.ts";

interface RecordedDecision {
  decision: "allowed" | "refused";
  permissions: string[];
}

export function buildOwnerAuthoriser(): AppAuthoriser & {
  recordDecision: (input: { tenantId: string; appUrl: string; decision: "allowed" | "refused" }) => void;
  listPending: (input: { tenantId: string }) => Array<{ appUrl: string; permissions: string[] }>;
} {
  const pending = new Map<string, { tenantId: string; appUrl: string; permissions: string[] }>();
  const decisions = new Map<string, RecordedDecision>();
  const keyOf = (request: { tenantId: string; appUrl: string }) => JSON.stringify([request.tenantId, request.appUrl]);
  return {
    decideApp: async (request): Promise<AppDecision> => {
      const recorded = decisions.get(keyOf(request));
      const covered = recorded !== undefined && request.permissions.every((permission) => recorded.permissions.includes(permission));
      if (covered) {
        return recorded.decision;
      }
      pending.set(keyOf(request), { tenantId: request.tenantId, appUrl: request.appUrl, permissions: [...request.permissions] });
      return "pending";
    },
    recordDecision: (request) => {
      const asked = pending.get(keyOf(request));
      if (asked === undefined) {
        return;
      }
      decisions.set(keyOf(request), { decision: request.decision, permissions: asked.permissions });
      pending.delete(keyOf(request));
    },
    listPending: (request) =>
      [...pending.values()]
        .filter((asked) => asked.tenantId === request.tenantId)
        .map((asked) => ({ appUrl: asked.appUrl, permissions: [...asked.permissions] })),
  };
}
