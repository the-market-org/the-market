/** Prices a cart from the catalog. Prices never come from the shopper. */

export interface CatalogProduct {
  productId: string;
  title: string;
  priceMinor: number;
  currencyCode: string;
}

export interface PricedLine {
  productId: string;
  title: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface PricedCart {
  currencyCode: string;
  totalMinor: number;
  lines: PricedLine[];
}

/** One line, priced; a product the catalog no longer has is refused. */
export function priceLine(input: { productId: string; quantity: number; product: CatalogProduct | undefined }): PricedLine & { currencyCode: string } {
  if (input.product === undefined) {
    throw new Error(`Product not available: ${input.productId}`);
  }
  const { product } = input;
  return { productId: input.productId, title: product.title, quantity: input.quantity, unitPriceMinor: product.priceMinor, lineTotalMinor: product.priceMinor * input.quantity, currencyCode: product.currencyCode };
}

export function priceCart(input: { lines: Array<{ productId: string; quantity: number }>; products: CatalogProduct[]; priceOne: typeof priceLine }): PricedCart {
  if (input.lines.length === 0) {
    throw new Error("Cart is empty");
  }
  const catalog = new Map(input.products.map((product) => [product.productId, product]));
  const priced = input.lines.map((line) => input.priceOne({ ...line, product: catalog.get(line.productId) }));
  const currencies = new Set(priced.map((line) => line.currencyCode));
  if (currencies.size > 1) {
    throw new Error("Cart mixes currencies");
  }
  return {
    currencyCode: String(priced[0]?.currencyCode),
    totalMinor: priced.reduce((sum, line) => sum + line.lineTotalMinor, 0),
    lines: priced.map(({ currencyCode: _currency, ...line }) => line),
  };
}
