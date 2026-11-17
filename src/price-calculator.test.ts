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

  it('applies a percentage discount to the gross line amount', () => {
    const item = { sku: 'A', unitPrice: 10, quantity: 3, discount: { kind: 'percentage' as const, percent: 10 } };
    expect(lineDiscount(item)).toBe(3);
  });

  it.each([-1, 101])('throws RangeError for percentage %p', (percent) => {
    const item = { sku: 'A', unitPrice: 10, quantity: 1, discount: { kind: 'percentage' as const, percent } };
    expect(() => lineDiscount(item)).toThrow(RangeError);
    expect(() => lineDiscount(item)).toThrow(/Invalid percentage/);
  });

  it('applies a fixed discount, capped at the gross amount', () => {
    const base = { sku: 'A', unitPrice: 10, quantity: 2 };
    expect(lineDiscount({ ...base, discount: { kind: 'fixed', amount: 5 } })).toBe(5);
    expect(lineDiscount({ ...base, discount: { kind: 'fixed', amount: 50 } })).toBe(20);
  });

  it('throws RangeError for a negative fixed amount', () => {
    const item = { sku: 'A', unitPrice: 10, quantity: 2, discount: { kind: 'fixed' as const, amount: -1 } };
    expect(() => lineDiscount(item)).toThrow(RangeError);
    expect(() => lineDiscount(item)).toThrow(/Invalid fixed discount/);
  });

  it('gives free units for buy-x-get-y in complete groups only', () => {
    const item = {
      sku: 'A',
      unitPrice: 5,
      quantity: 7,
      discount: { kind: 'buy-x-get-y' as const, buy: 2, free: 1 },
    };
    expect(lineDiscount(item)).toBe(10);
  });

  it.each([
    [0, 1],
    [1, 0],
  ])('throws RangeError when buy=%p and free=%p', (buy, free) => {
    const item = { sku: 'A', unitPrice: 5, quantity: 7, discount: { kind: 'buy-x-get-y' as const, buy, free } };
    expect(() => lineDiscount(item)).toThrow(RangeError);
    expect(() => lineDiscount(item)).toThrow(/Invalid buy-x-get-y/);
  });
});

describe('calculateTotal', () => {
  it('returns zeros for an empty cart with default options', () => {
    expect(calculateTotal([])).toEqual({ subtotal: 0, discountTotal: 0, tax: 0, total: 0 });
  });

  it('sums subtotal and line discounts across items, then applies tax', () => {
    const result = calculateTotal(
      [
        { sku: 'A', unitPrice: 10, quantity: 3, discount: { kind: 'percentage', percent: 10 } },
        { sku: 'B', unitPrice: 5, quantity: 4, discount: { kind: 'fixed', amount: 5 } },
      ],
      { taxRatePercent: 20 },
    );
    expect(result).toEqual({ subtotal: 50, discountTotal: 8, tax: 8.4, total: 50.4 });
  });

  it('throws RangeError when the tax rate is negative', () => {
    expect(() => calculateTotal([], { taxRatePercent: -1 })).toThrow(RangeError);
    expect(() => calculateTotal([], { taxRatePercent: -1 })).toThrow(/Tax rate/);
  });

  it('throws RangeError for a negative unit price', () => {
    expect(() => calculateTotal([{ sku: 'A', unitPrice: -1, quantity: 1 }])).toThrow(/Negative unit price for A/);
  });

  it.each([1.5, -1])('throws RangeError for quantity %p', (quantity) => {
    expect(() => calculateTotal([{ sku: 'A', unitPrice: 1, quantity }])).toThrow(RangeError);
    expect(() => calculateTotal([{ sku: 'A', unitPrice: 1, quantity }])).toThrow(/Quantity must be/);
  });

  it('treats quantity 0 as valid and contributes nothing', () => {
    expect(calculateTotal([{ sku: 'A', unitPrice: 9, quantity: 0 }])).toEqual({
      subtotal: 0,
      discountTotal: 0,
      tax: 0,
      total: 0,
    });
  });

  it('applies the order discount to the amount left after line discounts', () => {
    const items = [
      { sku: 'A', unitPrice: 50, quantity: 2, discount: { kind: 'percentage' as const, percent: 10 } },
    ];
    const result = calculateTotal(items, { orderDiscountPercent: 10 });
    expect(result).toEqual({ subtotal: 100, discountTotal: 19, tax: 0, total: 81 });
    expect(calculateTotal(items, { orderDiscountPercent: 0 }).discountTotal).toBe(10);
    expect(calculateTotal(items, { orderDiscountPercent: 50 }).discountTotal).toBe(55);
  });

  it.each([-1, 51])('throws RangeError when the order discount is %p', (orderDiscountPercent) => {
    expect(() => calculateTotal([], { orderDiscountPercent })).toThrow(RangeError);
    expect(() => calculateTotal([], { orderDiscountPercent })).toThrow(/Order discount/);
  });

  it('uses the given rounding mode for every field', () => {
    const items = [{ sku: 'A', unitPrice: 0.335, quantity: 1 }];
    const down = calculateTotal(items, { taxRatePercent: 10, rounding: 'down' });
    const up = calculateTotal(items, { taxRatePercent: 10, rounding: 'up' });
    expect(down.subtotal).toBe(0.33);
    expect(up.subtotal).toBe(0.34);
  });
});
