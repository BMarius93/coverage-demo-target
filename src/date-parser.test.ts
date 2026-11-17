import { formatIso, isLeapYear } from './date-parser';

describe('date-parser', () => {
  it('formats a date as ISO with zero padding', () => {
    expect(formatIso({ year: 2024, month: 1, day: 5 })).toBe('2024-01-05');
  });

  it('detects a leap year', () => {
    expect(isLeapYear(2024)).toBe(true);
  });
});
