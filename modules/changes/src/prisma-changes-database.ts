/**
 * The only file in this module that touches Prisma. It implements the
 * ChangesDatabase port and is the only place that turns a tenant id into a query filter.
 */
import type { ChangeItemRecord, ChangeSetRecord, ChangesDatabase } from "./changes-types.ts";
import { runAsTenant } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import type { Prisma } from "./generated/client/index.js";

interface StoredChangeSet {
  changeSetId: string;
  tenantId: string;
  title: string;
  state: string;
  proposedBy: string;
  approvedBy: string;
  failureReason: string;
  items: ChangeItemRecord[];
}

/** Reduces a stored change set to the public record, items in position order. */
export function describeChangeSet(stored: StoredChangeSet): ChangeSetRecord {
  return {
    changeSetId: stored.changeSetId,
    tenantId: stored.tenantId,
    title: stored.title,
    state: stored.state,
    proposedBy: stored.proposedBy,
    approvedBy: stored.approvedBy,
    failureReason: stored.failureReason,
    items: stored.items.map((item) => ({
      itemId: item.itemId,
      position: item.position,
      capabilityName: item.capabilityName,
      summary: item.summary,
      change: item.change,
      revert: item.revert,
    })),
  };
}

/** The columns a state move writes. Empty texts leave the stored values alone. */
export function buildStateData(input: { toState: string; approvedBy: string; failureReason: string }) {
  return {
    state: input.toState,
    ...(input.approvedBy === "" ? {} : { approvedBy: input.approvedBy }),
    ...(input.failureReason === "" ? {} : { failureReason: input.failureReason }),
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a UUID. Anything else cannot be a stored id, so it is treated as not found without a query. */
export function isWellFormedId(text: string): boolean {
  return UUID_PATTERN.test(text);
}

const ITEMS_IN_ORDER = { items: { orderBy: { position: "asc" } } } as const;

export function buildChangesDatabase(input: { databaseUrl: string }): ChangesDatabase & {
  disconnect: () => Promise<void>;
} {
  const client = new PrismaClient({ datasourceUrl: input.databaseUrl });
  const asTenant = <Result>(tenantId: string, work: (transaction: Prisma.TransactionClient) => Promise<Result>) => runAsTenant({ client, tenantId, work });
  return {
    insertChangeSet: async (changeSet) =>
      describeChangeSet(await asTenant(changeSet.tenantId, (transaction) => transaction.changeSet.create({ data: changeSet, include: ITEMS_IN_ORDER }))),
    listChangeSets: async (query) => {
      const stored = await asTenant(query.tenantId, (transaction) => transaction.changeSet.findMany({ where: { tenantId: query.tenantId }, orderBy: { createdAt: "desc" }, take: query.limit, include: { _count: { select: { items: true } } } }));
      return stored.map((set) => ({ changeSetId: set.changeSetId, title: set.title, state: set.state, proposedBy: set.proposedBy, itemCount: set._count.items }));
    },
    findChangeSet: async (query) => {
      const records = isWellFormedId(query.changeSetId)
        ? await asTenant(query.tenantId, (transaction) =>
            transaction.changeSet.findMany({
              where: { tenantId: query.tenantId, changeSetId: query.changeSetId },
              include: ITEMS_IN_ORDER,
            }),
          )
        : [];
      return records.map(describeChangeSet)[0];
    },
    insertChangeItem: (item) =>
      asTenant(item.tenantId, async (transaction) => {
        const position = await transaction.changeItem.count({
          where: { tenantId: item.tenantId, changeSetId: item.changeSetId },
        });
        return transaction.changeItem.create({
          data: {
            ...item,
            position,
            change: item.change as Prisma.InputJsonValue,
            revert: item.revert as Prisma.InputJsonValue,
          },
        });
      }),
    updateState: async (move) => {
      const result = isWellFormedId(move.changeSetId)
        ? await asTenant(move.tenantId, (transaction) =>
            transaction.changeSet.updateMany({
              where: { tenantId: move.tenantId, changeSetId: move.changeSetId, state: move.fromState },
              data: buildStateData(move),
            }),
          )
        : { count: 0 };
      return result.count;
    },
    disconnect: () => client.$disconnect(),
  };
}
