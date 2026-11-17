export type Discount =
  | { kind: 'percentage'; percent: number }
  | { kind: 'fixed'; amount: number }
  | { kind: 'buy-x-get-y'; buy: number; free: number };

export interface LineItem {
  sku: string;
  unitPrice: number;
  quantity: number;
  discount?: Discount;
}

export type RoundingMode = 'half-up' | 'down' | 'up';

export interface PriceBreakdown {
  subtotal: number;
  discountTotal: number;
  tax: number;
  total: number;
}

export function roundMoney(value: number, mode: RoundingMode = 'half-up'): number {
  const cents = value * 100;
  switch (mode) {
    case 'down':
      return Math.floor(cents + 1e-9) / 100;
    case 'up':
      return Math.ceil(cents - 1e-9) / 100;
    case 'half-up':
    default:
      return Math.round(cents + 1e-9) / 100;
  }
}

function validateItem(item: LineItem): void {
  if (item.unitPrice < 0) {
    throw new RangeError(`Negative unit price for ${item.sku}`);
  }
  if (!Number.isInteger(item.quantity) || item.quantity < 0) {
    throw new RangeError(`Quantity must be a non-negative integer for ${item.sku}`);
  }
}

export function lineDiscount(item: LineItem): number {
  const gross = item.unitPrice * item.quantity;
  const discount = item.discount;
  if (!discount) return 0;

  switch (discount.kind) {
    case 'percentage':
      if (discount.percent < 0 || discount.percent > 100) {
        throw new RangeError(`Invalid percentage ${discount.percent} for ${item.sku}`);
      }
      return (gross * discount.percent) / 100;
    case 'fixed':
      if (discount.amount < 0) {
        throw new RangeError(`Invalid fixed discount for ${item.sku}`);
      }
      return Math.min(discount.amount, gross);
    case 'buy-x-get-y': {
      if (discount.buy <= 0 || discount.free <= 0) {
        throw new RangeError(`Invalid buy-x-get-y discount for ${item.sku}`);
      }
      const groupSize = discount.buy + discount.free;
      const freeUnits = Math.floor(item.quantity / groupSize) * discount.free;
      return freeUnits * item.unitPrice;
    }
  }
}

export interface CalculateOptions {
  taxRatePercent?: number;
  rounding?: RoundingMode;
  orderDiscountPercent?: number;
}

export function calculateTotal(items: LineItem[], options: CalculateOptions = {}): PriceBreakdown {
  const taxRate = options.taxRatePercent ?? 0;
  const rounding = options.rounding ?? 'half-up';
  if (taxRate < 0) {
    throw new RangeError('Tax rate cannot be negative');
  }

  let subtotal = 0;
  let discountTotal = 0;
  for (const item of items) {
    validateItem(item);
    subtotal += item.unitPrice * item.quantity;
    discountTotal += lineDiscount(item);
  }

  if (options.orderDiscountPercent !== undefined) {
    if (options.orderDiscountPercent < 0 || options.orderDiscountPercent > 50) {
      throw new RangeError('Order discount must be between 0 and 50 percent');
    }
    discountTotal += ((subtotal - discountTotal) * options.orderDiscountPercent) / 100;
  }

  const taxable = Math.max(0, subtotal - discountTotal);
  const tax = (taxable * taxRate) / 100;

  return {
    subtotal: roundMoney(subtotal, rounding),
    discountTotal: roundMoney(discountTotal, rounding),
    tax: roundMoney(tax, rounding),
    total: roundMoney(taxable + tax, rounding),
  };
}
