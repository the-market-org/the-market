/** One worked-out change inside a change set, in apply order. */
export interface ChangeItemRecord {
  itemId: string;
  position: number;
  capabilityName: string;
  summary: string;
  change: unknown;
  revert: unknown;
}

/** A group of changes that is approved, applied and reverted as one. */
export interface ChangeSetRecord {
  changeSetId: string;
  tenantId: string;
  title: string;
  state: string;
  proposedBy: string;
  approvedBy: string;
  failureReason: string;
  items: ChangeItemRecord[];
}

/** What the services need from storage. The Prisma adapter implements it. */
/** A change set as a list shows it: no items, just how many. */
export interface ChangeSetSummary {
  changeSetId: string;
  title: string;
  state: string;
  proposedBy: string;
  itemCount: number;
}

export interface ChangesDatabase {
  /** The store's change sets, newest first, at most `limit`. */
  listChangeSets: (input: { tenantId: string; limit: number }) => Promise<ChangeSetSummary[]>;
  insertChangeSet: (input: { tenantId: string; title: string; proposedBy: string }) => Promise<ChangeSetRecord>;
  /** Items are ordered by position. Returns undefined for another tenant's change set. */
  findChangeSet: (input: { tenantId: string; changeSetId: string }) => Promise<ChangeSetRecord | undefined>;
  /** Stores the item at the next position. */
  insertChangeItem: (input: {
    tenantId: string;
    changeSetId: string;
    capabilityName: string;
    summary: string;
    change: unknown;
    revert: unknown;
  }) => Promise<ChangeItemRecord>;
  /**
   * Moves the state only when tenant, id and current state all match. Returns rows changed, 0 or 1.
   * An empty approvedBy or failureReason leaves the stored value unchanged.
   */
  updateState: (input: {
    tenantId: string;
    changeSetId: string;
    fromState: string;
    toState: string;
    approvedBy: string;
    failureReason: string;
  }) => Promise<number>;
}
