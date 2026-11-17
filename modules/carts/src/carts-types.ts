export interface CartLineRecord {
  productId: string;
  quantity: number;
}

export interface CartRecord {
  cartId: string;
  tenantId: string;
  status: string;
  lines: CartLineRecord[];
}

/** What the services need from storage. The Prisma adapter implements it. */
export interface CartsDatabase {
  insertCart: (input: { tenantId: string }) => Promise<CartRecord>;
  /** Undefined for an unknown id, another tenant's cart, or an id that is not a UUID. */
  findCart: (input: { tenantId: string; cartId: string }) => Promise<CartRecord | undefined>;
  /** Sets one product's quantity; 0 removes the line. The caller has checked the cart exists. */
  setLine: (input: { tenantId: string; cartId: string; productId: string; quantity: number }) => Promise<void>;
  /** Changes the status only from the stated one. Returns rows changed, 0 or 1. */
  updateStatus: (input: { tenantId: string; cartId: string; fromStatus: string; toStatus: string }) => Promise<number>;
}
