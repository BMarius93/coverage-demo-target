import { calculateTotal, lineDiscount, roundMoney } from './price-calculator';

describe('roundMoney', () => {
  it('rounds half up by default', () => {
    expect(roundMoney(1.005)).toBe(1.01);
  });

  it('rounds down when mode is down', () => {
    expect(roundMoney(1.239, 'down')).toBe(1.23);
    expect(roundMoney(1.2, 'down')).toBe(1.2);
  });

  it('rounds up when mode is up', () => {
    expect(roundMoney(1.231, 'up')).toBe(1.24);
    expect(roundMoney(2, 'up')).toBe(2);
  });
});

describe('lineDiscount', () => {
  it('returns 0 when the item has no discount', () => {
    expect(lineDiscount({ sku: 'A', unitPrice: 10, quantity: 2 })).toBe(0);
  });

  it('applies a percentage discount to the gross line amount', () => {
    const item = { sku: 'A', unitPrice: 10, quantity: 2 };
    expect(lineDiscount({ ...item, discount: { kind: 'percentage', percent: 10 } })).toBe(2);
    expect(lineDiscount({ ...item, discount: { kind: 'percentage', percent: 100 } })).toBe(20);
    expect(lineDiscount({ ...item, discount: { kind: 'percentage', percent: 0 } })).toBe(0);
  });

  it('rejects percentages outside 0-100', () => {
    const item = { sku: 'SKU-P', unitPrice: 10, quantity: 2 };
    expect(() =>
      lineDiscount({ ...item, discount: { kind: 'percentage', percent: -1 } }),
    ).toThrow(RangeError);
    expect(() =>
      lineDiscount({ ...item, discount: { kind: 'percentage', percent: 101 } }),
    ).toThrow(/SKU-P/);
  });

  it('applies a fixed discount capped at the gross amount', () => {
    const item = { sku: 'A', unitPrice: 10, quantity: 1 };
    expect(lineDiscount({ ...item, discount: { kind: 'fixed', amount: 5 } })).toBe(5);
    expect(lineDiscount({ ...item, discount: { kind: 'fixed', amount: 50 } })).toBe(10);
  });

  it('rejects a negative fixed discount', () => {
    expect(() =>
      lineDiscount({
        sku: 'A',
        unitPrice: 10,
        quantity: 1,
        discount: { kind: 'fixed', amount: -1 },
      }),
    ).toThrow(RangeError);
  });

  it('gives free units for buy-x-get-y per complete group', () => {
    const discount = { kind: 'buy-x-get-y' as const, buy: 2, free: 1 };
    expect(lineDiscount({ sku: 'A', unitPrice: 3, quantity: 7, discount })).toBe(6);
    expect(lineDiscount({ sku: 'A', unitPrice: 3, quantity: 2, discount })).toBe(0);
  });

  it('rejects buy-x-get-y with non-positive buy or free', () => {
    const item = { sku: 'A', unitPrice: 3, quantity: 7 };
    expect(() =>
      lineDiscount({ ...item, discount: { kind: 'buy-x-get-y', buy: 0, free: 1 } }),
    ).toThrow(RangeError);
    expect(() =>
      lineDiscount({ ...item, discount: { kind: 'buy-x-get-y', buy: 2, free: 0 } }),
    ).toThrow(RangeError);
  });
});

describe('calculateTotal', () => {
  it('returns zeros for an empty cart with default options', () => {
    expect(calculateTotal([])).toEqual({ subtotal: 0, discountTotal: 0, tax: 0, total: 0 });
  });

  it('sums line items and applies tax', () => {
    const result = calculateTotal(
      [
        { sku: 'A', unitPrice: 10, quantity: 3 },
        { sku: 'B', unitPrice: 5, quantity: 2 },
      ],
      { taxRatePercent: 20 },
    );
    expect(result).toEqual({ subtotal: 40, discountTotal: 0, tax: 8, total: 48 });
  });

  it('subtracts line discounts before tax', () => {
    const result = calculateTotal(
      [{ sku: 'A', unitPrice: 50, quantity: 2, discount: { kind: 'percentage', percent: 10 } }],
      { taxRatePercent: 10 },
    );
    expect(result).toEqual({ subtotal: 100, discountTotal: 10, tax: 9, total: 99 });
  });

  it('throws on a negative tax rate', () => {
    expect(() => calculateTotal([], { taxRatePercent: -1 })).toThrow(
      'Tax rate cannot be negative',
    );
  });

  it('rejects an item with a negative unit price', () => {
    expect(() => calculateTotal([{ sku: 'NEG', unitPrice: -1, quantity: 1 }])).toThrow(
      RangeError,
    );
    expect(() => calculateTotal([{ sku: 'NEG', unitPrice: -1, quantity: 1 }])).toThrow(/NEG/);
  });

  it('rejects non-integer or negative quantities', () => {
    expect(() => calculateTotal([{ sku: 'A', unitPrice: 1, quantity: 1.5 }])).toThrow(
      RangeError,
    );
    expect(() => calculateTotal([{ sku: 'A', unitPrice: 1, quantity: -1 }])).toThrow(
      RangeError,
    );
  });

  it('applies an order discount to the already-discounted amount', () => {
    const items = [
      { sku: 'A', unitPrice: 100, quantity: 1, discount: { kind: 'fixed' as const, amount: 20 } },
    ];
    expect(calculateTotal(items, { orderDiscountPercent: 10 })).toEqual({
      subtotal: 100,
      discountTotal: 28,
      tax: 0,
      total: 72,
    });
    expect(calculateTotal(items, { orderDiscountPercent: 0 }).discountTotal).toBe(20);
  });

  it('rejects order discounts outside 0-50 percent', () => {
    expect(() => calculateTotal([], { orderDiscountPercent: -1 })).toThrow(RangeError);
    expect(() => calculateTotal([], { orderDiscountPercent: 51 })).toThrow(RangeError);
  });

  it('uses the requested rounding mode for every field', () => {
    const items = [{ sku: 'A', unitPrice: 0.333, quantity: 1 }];
    expect(calculateTotal(items, { rounding: 'down' }).subtotal).toBe(0.33);
    expect(calculateTotal(items, { rounding: 'up' }).subtotal).toBe(0.34);
  });
});
