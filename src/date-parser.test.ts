import {
  DateParseError,
  compareDates,
  daysInMonth,
  formatIso,
  isLeapYear,
  parseDate,
} from './date-parser';

describe('date-parser', () => {
  it('formats a date as ISO with zero padding', () => {
    expect(formatIso({ year: 2024, month: 1, day: 5 })).toBe('2024-01-05');
  });

  it('detects a leap year', () => {
    expect(isLeapYear(2024)).toBe(true);
  });

  it('treats years divisible by 400 as leap and other century years as non-leap', () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2023)).toBe(false);
  });
});

describe('daysInMonth', () => {
  it('throws RangeError for months outside 1-12', () => {
    expect(() => daysInMonth(2024, 0)).toThrow(RangeError);
    expect(() => daysInMonth(2024, 13)).toThrow('Month out of range');
  });

  it('returns 29 or 28 for February depending on leap year', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
  });

  it('returns 30 for April, June, September, November and 31 otherwise', () => {
    expect(daysInMonth(2023, 4)).toBe(30);
    expect(daysInMonth(2023, 11)).toBe(30);
    expect(daysInMonth(2023, 1)).toBe(31);
    expect(daysInMonth(2023, 12)).toBe(31);
  });
});

describe('parseDate', () => {
  it('defaults to ISO format and returns year, month and day', () => {
    expect(parseDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseDate('  2023-12-31  ', 'iso')).toEqual({ year: 2023, month: 12, day: 31 });
  });

  it('throws DateParseError for empty or whitespace-only input', () => {
    expect.assertions(3);
    try {
      parseDate('   ');
    } catch (error) {
      expect(error).toBeInstanceOf(DateParseError);
      expect((error as DateParseError).name).toBe('DateParseError');
      expect((error as DateParseError).message).toContain('empty input');
    }
  });

  it('rejects ISO strings that do not match YYYY-MM-DD', () => {
    expect(() => parseDate('2024/01/05')).toThrow('expected YYYY-MM-DD');
    expect(() => parseDate('24-1-5', 'iso')).toThrow('expected YYYY-MM-DD');
  });

  it('rejects years outside 1900-2999', () => {
    expect(() => parseDate('1899-12-31')).toThrow('year must be between 1900 and 2999');
    expect(() => parseDate('3000-01-01')).toThrow('year must be between 1900 and 2999');
  });

  it('rejects month 00 and month 13', () => {
    expect(() => parseDate('2024-00-10')).toThrow('month must be between 1 and 12');
    expect(() => parseDate('2024-13-10')).toThrow('month must be between 1 and 12');
  });

  it('rejects day 0 and days past the end of the month', () => {
    expect(() => parseDate('2024-01-00')).toThrow('day must be between 1 and 31');
    expect(() => parseDate('2023-02-29')).toThrow('day must be between 1 and 28');
    expect(() => parseDate('2024-04-31')).toThrow('day must be between 1 and 30');
  });

  it('throws errors that are DateParseError instances including the input', () => {
    expect(() => parseDate('2023-02-29')).toThrow(DateParseError);
    expect(() => parseDate('2023-02-29')).toThrow('Cannot parse date "2023-02-29"');
  });

  describe('eu format', () => {
    it('accepts dot and slash separators as DD.MM.YYYY', () => {
      expect(parseDate('05.01.2024', 'eu')).toEqual({ year: 2024, month: 1, day: 5 });
      expect(parseDate('5/1/2024', 'eu')).toEqual({ year: 2024, month: 1, day: 5 });
    });

    it('rejects non-matching input and validates the result', () => {
      expect(() => parseDate('2024-01-05', 'eu')).toThrow('expected DD.MM.YYYY or DD/MM/YYYY');
      expect(() => parseDate('31.04.2024', 'eu')).toThrow('day must be between 1 and 30');
    });
  });

  describe('us format', () => {
    it('parses MM/DD/YYYY', () => {
      expect(parseDate('01/05/2024', 'us')).toEqual({ year: 2024, month: 1, day: 5 });
    });

    it('rejects dot-separated or malformed input', () => {
      expect(() => parseDate('01.05.2024', 'us')).toThrow('expected MM/DD/YYYY');
    });
  });
});

describe('compareDates', () => {
  it('orders by year first', () => {
    const earlier = { year: 2023, month: 12, day: 31 };
    const later = { year: 2024, month: 1, day: 1 };
    expect(compareDates(earlier, later)).toBeLessThan(0);
    expect(compareDates(later, earlier)).toBeGreaterThan(0);
  });

  it('orders by month when years are equal', () => {
    const earlier = { year: 2024, month: 1, day: 31 };
    const later = { year: 2024, month: 2, day: 1 };
    expect(compareDates(earlier, later)).toBeLessThan(0);
    expect(compareDates(later, earlier)).toBeGreaterThan(0);
  });

  it('orders by day and returns 0 for identical dates', () => {
    const earlier = { year: 2024, month: 3, day: 1 };
    const later = { year: 2024, month: 3, day: 2 };
    expect(compareDates(earlier, later)).toBeLessThan(0);
    expect(compareDates(later, earlier)).toBeGreaterThan(0);
    expect(compareDates(earlier, { ...earlier })).toBe(0);
  });
});
