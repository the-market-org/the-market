/** The cart and order pages, and the document shell every storefront page shares. All values are escaped. */

type Escape = (text: string) => string;

export function wrapDocument(input: { title: string; body: string; escape: Escape }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${input.escape(input.title)}</title></head><body><main>${input.body}</main></body></html>`;
}

export interface CartPageLine {
  title: string;
  quantity: number;
  lineTotalText: string;
}

/** The lines and total with a Pay button, or a note that the cart is empty; a checkout error is shown above. */
export function renderCartPage(input: { storeName: string; lines: CartPageLine[]; totalText: string; errorMessage: string; escape: Escape }): string {
  const { escape } = input;
  const error = input.errorMessage === "" ? "" : `<p class="error">${escape(input.errorMessage)}</p>`;
  const items = input.lines.map((line) => `<li>${line.quantity} × ${escape(line.title)} <span>${escape(line.lineTotalText)}</span></li>`).join("");
  const content =
    input.lines.length === 0
      ? "<p>Your cart is empty.</p>"
      : `<ul>${items}</ul><p class="total">Total ${escape(input.totalText)}</p><form method="post" action="/cart/checkout"><button>Pay</button></form>`;
  return wrapDocument({ title: input.storeName, body: `<section class="cart"><h1>Your cart</h1>${error}${content}</section>`, escape });
}

export function renderOrderPage(input: { storeName: string; orderNumber: number; totalText: string; escape: Escape }): string {
  const body = `<section class="order"><h1>Thank you</h1><p>Order ${input.orderNumber} is paid: ${input.escape(input.totalText)}.</p><p><a href="/">Back to the shop</a></p></section>`;
  return wrapDocument({ title: input.storeName, body, escape: input.escape });
}
