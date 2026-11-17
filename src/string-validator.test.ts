import { isEmail } from './string-validator';

describe('isEmail', () => {
  it('accepts a simple address', () => {
    expect(isEmail('ada@example.com')).toBe(true);
  });
});
