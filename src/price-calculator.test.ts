import { calculateTotal, lineDiscount, roundMoney } from './price-calculator';

describe('roundMoney', () => {
  it('rounds half up by default', () => {
    expect(roundMoney(1.005)).toBe(1.01);
  });

  it("rounds down when mode is 'down'", () => {
    expect(roundMoney(1.239, 'down')).toBe(1.23);
    expect(roundMoney(1.2, 'down')).toBe(1.2);
  });

  it("rounds up when mode is 'up'", () => {
    expect(roundMoney(1.231, 'up')).toBe(1.24);
    expect(roundMoney(1.2, 'up')).toBe(1.2);
  });
});

describe('lineDiscount', () => {
  it('returns 0 when the item has no discount', () => {
    expect(lineDiscount({ sku: 'A', unitPrice: 10, quantity: 3 })).toBe(0);
  });

  it('applies a percentage discount to the gross amount', () => {
    const item = {
      sku: 'A',
      unitPrice: 10,
      quantity: 3,
      discount: { kind: 'percentage' as const, percent: 10 },
    };
    expect(lineDiscount(item)).toBe(3);
  });

  it('throws RangeError for a percentage below 0 or above 100', () => {
    const make = (percent: number) => ({
      sku: 'A',
      unitPrice: 10,
      quantity: 1,
      discount: { kind: 'percentage' as const, percent },
    });
    expect(() => lineDiscount(make(-1))).toThrow(RangeError);
    expect(() => lineDiscount(make(101))).toThrow(RangeError);
  });

  it('applies a fixed discount capped at the gross amount', () => {
    const make = (amount: number) => ({
      sku: 'A',
      unitPrice: 10,
      quantity: 2,
      discount: { kind: 'fixed' as const, amount },
    });
    expect(lineDiscount(make(5))).toBe(5);
    expect(lineDiscount(make(50))).toBe(20);
  });

  it('throws RangeError for a negative fixed discount', () => {
    const item = {
      sku: 'A',
      unitPrice: 10,
      quantity: 2,
      discount: { kind: 'fixed' as const, amount: -1 },
    };
    expect(() => lineDiscount(item)).toThrow(RangeError);
  });

  it('gives free units for buy-x-get-y per complete group', () => {
    const make = (quantity: number) => ({
      sku: 'A',
      unitPrice: 4,
      quantity,
      discount: { kind: 'buy-x-get-y' as const, buy: 2, free: 1 },
    });
    expect(lineDiscount(make(7))).toBe(8);
    expect(lineDiscount(make(2))).toBe(0);
  });

  it('throws RangeError when buy or free is not positive', () => {
    const make = (buy: number, free: number) => ({
      sku: 'A',
      unitPrice: 4,
      quantity: 5,
      discount: { kind: 'buy-x-get-y' as const, buy, free },
    });
    expect(() => lineDiscount(make(0, 1))).toThrow(RangeError);
    expect(() => lineDiscount(make(2, 0))).toThrow(RangeError);
  });
});

describe('calculateTotal', () => {
  it('returns zeros for an empty cart with default options', () => {
    expect(calculateTotal([])).toEqual({ subtotal: 0, discountTotal: 0, tax: 0, total: 0 });
  });

  it('sums items, applies line discounts and tax', () => {
    const result = calculateTotal(
      [
        {
          sku: 'A',
          unitPrice: 10,
          quantity: 3,
          discount: { kind: 'percentage', percent: 10 },
        },
        { sku: 'B', unitPrice: 5, quantity: 2 },
      ],
      { taxRatePercent: 20 },
    );
    expect(result).toEqual({ subtotal: 40, discountTotal: 3, tax: 7.4, total: 44.4 });
  });

  it('applies an order discount on the amount after line discounts', () => {
    const result = calculateTotal(
      [
        {
          sku: 'A',
          unitPrice: 10,
          quantity: 3,
          discount: { kind: 'percentage', percent: 10 },
        },
      ],
      { orderDiscountPercent: 10 },
    );
    expect(result).toEqual({ subtotal: 30, discountTotal: 5.7, tax: 0, total: 24.3 });
  });

  it('throws RangeError when order discount is below 0 or above 50', () => {
    const items = [{ sku: 'A', unitPrice: 10, quantity: 1 }];
    expect(() => calculateTotal(items, { orderDiscountPercent: -1 })).toThrow(RangeError);
    expect(() => calculateTotal(items, { orderDiscountPercent: 51 })).toThrow(RangeError);
  });

  it('throws RangeError for a negative tax rate', () => {
    expect(() => calculateTotal([], { taxRatePercent: -5 })).toThrow(RangeError);
  });

  it('uses the given rounding mode for every field', () => {
    const items = [{ sku: 'A', unitPrice: 3.333, quantity: 1 }];
    expect(calculateTotal(items, { taxRatePercent: 10, rounding: 'down' })).toEqual({
      subtotal: 3.33,
      discountTotal: 0,
      tax: 0.33,
      total: 3.66,
    });
    expect(calculateTotal(items, { taxRatePercent: 10, rounding: 'up' })).toMatchObject({
      subtotal: 3.34,
      tax: 0.34,
      total: 3.67,
    });
  });

  it('throws RangeError for a negative unit price', () => {
    expect(() => calculateTotal([{ sku: 'A', unitPrice: -1, quantity: 1 }])).toThrow(RangeError);
  });

  it('throws RangeError for a non-integer or negative quantity', () => {
    expect(() => calculateTotal([{ sku: 'A', unitPrice: 1, quantity: 1.5 }])).toThrow(RangeError);
    expect(() => calculateTotal([{ sku: 'A', unitPrice: 1, quantity: -1 }])).toThrow(RangeError);
  });
});
