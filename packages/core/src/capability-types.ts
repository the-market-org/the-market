/** How much harm a capability can do if applied wrongly. Decides who must approve it. */
export type RiskTier = "low" | "medium" | "high";

/** One worked-out change: what it does, how to apply it and how to undo it. */
export interface ChangeItem {
  capabilityName: string;
  tenantId: string;
  /** One line a merchant can read, for example: Rename "Lead" to "Rope lead". */
  summary: string;
  change: unknown;
  revert: unknown;
}

/** A typed, reversible store operation that a module offers. */
export interface CapabilityDefinition {
  /** "<module>.<noun>.<verb>", for example "catalog.product.rename". */
  name: string;
  summary: string;
  /** JSON Schema of type "object" describing the candidate input. */
  inputSchema: Record<string, unknown>;
  risk: RiskTier;
  /** Works out the change and its undo without writing anything. */
  buildChange: (input: { tenantId: string; candidate: unknown }) => Promise<ChangeItem>;
  applyChange: (input: { tenantId: string; change: unknown }) => Promise<void>;
  revertChange: (input: { tenantId: string; revert: unknown }) => Promise<void>;
}

/** Every capability of every loaded module, keyed by capability name. */
export type CapabilityRegistry = Record<string, CapabilityDefinition>;
