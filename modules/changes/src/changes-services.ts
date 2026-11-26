import type { ServiceMap } from "@the-market/core";
import type { ChangeItemRecord, ChangeSetRecord, ChangesDatabase } from "./changes-types.ts";
import type { explainRefusedMove, moveChangeSet } from "./move-change-set.ts";

type FindSet = ChangesDatabase["findChangeSet"];

/** Adds an item to a change set that is still a draft. */
export async function addChangeItem(input: {
  tenantId: string;
  changeSetId: string;
  capabilityName: string;
  summary: string;
  change: unknown;
  revert: unknown;
  findSet: FindSet;
  insertItem: ChangesDatabase["insertChangeItem"];
}): Promise<ChangeItemRecord> {
  const changeSet = await input.findSet({ tenantId: input.tenantId, changeSetId: input.changeSetId });
  if (changeSet === undefined) {
    throw new Error("Change set not found");
  }
  if (changeSet.state !== "draft") {
    throw new Error("Change set is not a draft");
  }
  return input.insertItem({
    tenantId: input.tenantId,
    changeSetId: input.changeSetId,
    capabilityName: input.capabilityName,
    summary: input.summary,
    change: input.change,
    revert: input.revert,
  });
}

/** Builds the changes module's public services over a storage port. */
export function buildChangesServices(input: {
  database: ChangesDatabase;
  addOne: typeof addChangeItem;
  moveOne: typeof moveChangeSet;
  isAllowed: (move: { fromState: string; toState: string }) => boolean;
  explainRefusal: typeof explainRefusedMove;
  publishEvent: (eventName: string, payload: unknown) => Promise<void>;
}): ServiceMap {
  return {
    createChangeSet: (request: { tenantId: string; title: string; proposedBy: string }): Promise<ChangeSetRecord> =>
      input.database.insertChangeSet(request),
    findChangeSet: (request: { tenantId: string; changeSetId: string }) => input.database.findChangeSet(request),
    listChangeSets: (request: { tenantId: string; limit?: number }) => input.database.listChangeSets({ tenantId: request.tenantId, limit: Math.min(Math.max(1, request.limit ?? 20), 100) }),
    addChangeItem: (request: Omit<Parameters<typeof addChangeItem>[0], "findSet" | "insertItem">) =>
      input.addOne({ ...request, findSet: input.database.findChangeSet, insertItem: input.database.insertChangeItem }),
    /** Moves the state, then tells the rest of the system: `changes.change-set.moved`. */
    moveChangeSet: async (
      request: Omit<Parameters<typeof moveChangeSet>[0], "isAllowed" | "updateState" | "findSet" | "explainRefusal">,
    ) => {
      await input.moveOne({
        ...request,
        isAllowed: input.isAllowed,
        updateState: input.database.updateState,
        findSet: input.database.findChangeSet,
        explainRefusal: input.explainRefusal,
      });
      const { tenantId, changeSetId, fromState, toState } = request;
      await input.publishEvent("changes.change-set.moved", { tenantId, changeSetId, fromState, toState });
    },
  };
}
