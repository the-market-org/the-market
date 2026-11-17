import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedMove } from "./change-set-states.ts";
import { addChangeItem, buildChangesServices } from "./changes-services.ts";
import { explainRefusedMove, moveChangeSet } from "./move-change-set.ts";
import type { ChangeItemRecord, ChangeSetRecord, ChangesDatabase } from "./changes-types.ts";

interface ChangesServices {
  createChangeSet: (input: { tenantId: string; title: string; proposedBy: string }) => Promise<ChangeSetRecord>;
  findChangeSet: (input: { tenantId: string; changeSetId: string }) => Promise<ChangeSetRecord | undefined>;
  addChangeItem: (input: {
    tenantId: string;
    changeSetId: string;
    capabilityName: string;
    summary: string;
    change: unknown;
    revert: unknown;
  }) => Promise<ChangeItemRecord>;
  moveChangeSet: (input: {
    tenantId: string;
    changeSetId: string;
    fromState: string;
    toState: string;
    approvedBy: string;
    failureReason: string;
  }) => Promise<void>;
}

/** Array-backed fake that, like the real adapter, matches tenant and id together. */
function buildFakeDatabase(): ChangesDatabase {
  const stored: ChangeSetRecord[] = [];
  const findStored = (query: { tenantId: string; changeSetId: string }) =>
    stored.find((changeSet) => changeSet.tenantId === query.tenantId && changeSet.changeSetId === query.changeSetId);
  return {
    insertChangeSet: async (changeSet) => {
      const record = { ...changeSet, changeSetId: `set_${stored.length + 1}`, state: "draft", approvedBy: "", failureReason: "", items: [] };
      stored.push(record);
      return record;
    },
    findChangeSet: async (query) => findStored(query),
    insertChangeItem: async (item) => {
      const changeSet = findStored(item) as ChangeSetRecord;
      const record = { ...item, itemId: `item_${changeSet.items.length + 1}`, position: changeSet.items.length };
      changeSet.items.push(record);
      return record;
    },
    updateState: async (move) => {
      const changeSet = findStored(move);
      const matches = changeSet?.state === move.fromState;
      Object.assign(matches ? (changeSet as ChangeSetRecord) : {}, { state: move.toState });
      return matches ? 1 : 0;
    },
  };
}

function buildServices(): ChangesServices {
  return buildChangesServices({
    database: buildFakeDatabase(),
    addOne: addChangeItem,
    moveOne: moveChangeSet,
    isAllowed: isAllowedMove,
    explainRefusal: explainRefusedMove,
  }) as unknown as ChangesServices;
}

const rename = { capabilityName: "catalog.product.rename", summary: "Rename", change: { title: "New" }, revert: { title: "Old" } };
const noNames = { approvedBy: "", failureReason: "" };

async function createDraft(services: ChangesServices): Promise<ChangeSetRecord> {
  return services.createChangeSet({ tenantId: "tenant-a", title: "Rename leads", proposedBy: "merchant" });
}

test("items are added to a draft in order", async () => {
  const services = buildServices();
  const draft = await createDraft(services);
  const keys = { tenantId: "tenant-a", changeSetId: draft.changeSetId };

  await services.addChangeItem({ ...keys, ...rename });
  await services.addChangeItem({ ...keys, ...rename });

  assert.deepEqual((await services.findChangeSet(keys))?.items.map((item) => item.position), [0, 1]);
});

test("items cannot be added once the change set is approved", async () => {
  const services = buildServices();
  const draft = await createDraft(services);
  const keys = { tenantId: "tenant-a", changeSetId: draft.changeSetId };
  await services.moveChangeSet({ ...keys, fromState: "draft", toState: "approved", ...noNames });

  await assert.rejects(services.addChangeItem({ ...keys, ...rename }), { message: "Change set is not a draft" });
});

test("another tenant's change set is not found by any service", async () => {
  const services = buildServices();
  const draft = await createDraft(services);
  const keys = { tenantId: "tenant-b", changeSetId: draft.changeSetId };

  assert.equal(await services.findChangeSet(keys), undefined);
  await assert.rejects(services.addChangeItem({ ...keys, ...rename }), { message: "Change set not found" });
  await assert.rejects(services.moveChangeSet({ ...keys, fromState: "draft", toState: "approved", ...noNames }), {
    message: "Change set not found",
  });
});
