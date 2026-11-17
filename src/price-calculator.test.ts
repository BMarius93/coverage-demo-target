import { roundMoney } from './price-calculator';

describe('roundMoney', () => {
  it('rounds half up by default', () => {
    expect(roundMoney(1.005)).toBe(1.01);
  });
});
