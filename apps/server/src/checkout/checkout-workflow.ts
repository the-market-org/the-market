/**
 * Checkout: place the order, take the payment, mark it paid, close the cart. Run with the
 * workflow runner, so a failed step undoes the earlier ones: a declined payment cancels the order.
 */
import type { WorkflowStep } from "@the-market/core";
import type { PaymentProvider } from "@the-market/payment";
import type { PricedCart } from "./price-cart.ts";

export interface CheckoutState {
  tenantId: string;
  cartId: string;
  priced: PricedCart;
  orderId: string;
  orderNumber: number;
  paymentReference: string;
}

type PlacedOrder = { orderId: string; orderNumber: number };

export interface CheckoutActions {
  findCart: (input: { tenantId: string; cartId: string }) => Promise<{ status: string; lines: Array<{ productId: string; quantity: number }> } | undefined>;
  placeOrder: (input: { tenantId: string; currencyCode: string; totalMinor: number; lines: Array<{ productId: string; titleSnapshot: string; quantity: number; unitPriceMinor: number }> }) => Promise<PlacedOrder>;
  cancelOrder: (input: { tenantId: string; orderId: string }) => Promise<unknown>;
  markPaid: (input: { tenantId: string; orderId: string; paymentProviderId: string; paymentReference: string }) => Promise<unknown>;
  markConverted: (input: { tenantId: string; cartId: string }) => Promise<unknown>;
  provider: PaymentProvider;
}

/** The open cart's lines, or the reason there are none to check out. */
export async function loadOpenCart(input: { tenantId: string; cartId: string; findCart: CheckoutActions["findCart"] }) {
  const cart = await input.findCart({ tenantId: input.tenantId, cartId: input.cartId });
  if (cart === undefined) {
    throw new Error("Cart not found");
  }
  if (cart.status !== "open") {
    throw new Error("Cart is already checked out");
  }
  return cart.lines;
}

export function buildCheckoutSteps(actions: CheckoutActions): WorkflowStep<CheckoutState>[] {
  return [
    {
      stepName: "place order",
      run: async (state) => {
        const lines = state.priced.lines.map((line) => ({ productId: line.productId, titleSnapshot: line.title, quantity: line.quantity, unitPriceMinor: line.unitPriceMinor }));
        const order = await actions.placeOrder({ tenantId: state.tenantId, currencyCode: state.priced.currencyCode, totalMinor: state.priced.totalMinor, lines });
        return { ...state, orderId: order.orderId, orderNumber: order.orderNumber };
      },
      undo: async (state) => void (await actions.cancelOrder({ tenantId: state.tenantId, orderId: state.orderId })),
    },
    {
      stepName: "take payment",
      run: async (state) => {
        const payment = await actions.provider.createPayment({ orderId: state.orderId, amountMinor: state.priced.totalMinor, currencyCode: state.priced.currencyCode, idempotencyKey: state.orderId });
        return { ...state, paymentReference: payment.providerReference };
      },
      undo: async (state) => void (await actions.provider.cancelPayment({ providerReference: state.paymentReference, idempotencyKey: `cancel-${state.orderId}` })),
    },
    {
      stepName: "mark paid",
      run: async (state) => {
        await actions.markPaid({ tenantId: state.tenantId, orderId: state.orderId, paymentProviderId: actions.provider.providerId, paymentReference: state.paymentReference });
        return state;
      },
      undo: async () => {},
    },
    {
      stepName: "close cart",
      run: async (state) => {
        await actions.markConverted({ tenantId: state.tenantId, cartId: state.cartId });
        return state;
      },
      undo: async () => {},
    },
  ];
}
