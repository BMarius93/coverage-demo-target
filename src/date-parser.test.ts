import { compareDates, DateParseError, daysInMonth, formatIso, isLeapYear, parseDate } from './date-parser';

describe('date-parser', () => {
  it('formats a date as ISO with zero padding', () => {
    expect(formatIso({ year: 2024, month: 1, day: 5 })).toBe('2024-01-05');
  });

  it('detects a leap year', () => {
    expect(isLeapYear(2024)).toBe(true);
  });

  it('treats century years divisible by 400 as leap years and other century years as common years', () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2023)).toBe(false);
  });

  describe('daysInMonth', () => {
    it('throws a RangeError for months below 1 or above 12', () => {
      expect(() => daysInMonth(2024, 0)).toThrow(RangeError);
      expect(() => daysInMonth(2024, 13)).toThrow('Month out of range: 13');
    });

    it('returns 29 for February in a leap year and 28 otherwise', () => {
      expect(daysInMonth(2024, 2)).toBe(29);
      expect(daysInMonth(2023, 2)).toBe(28);
    });

    it('returns 30 for April, June, September and November and 31 for other months', () => {
      for (const month of [4, 6, 9, 11]) {
        expect(daysInMonth(2024, month)).toBe(30);
      }
      expect(daysInMonth(2024, 1)).toBe(31);
      expect(daysInMonth(2024, 12)).toBe(31);
    });
  });

  describe('parseDate', () => {
    it('parses an ISO date when no format is given', () => {
      expect(parseDate('2024-03-15')).toEqual({ year: 2024, month: 3, day: 15 });
    });

    it('trims surrounding whitespace before matching', () => {
      expect(parseDate('  2024-03-15  ', 'iso')).toEqual({ year: 2024, month: 3, day: 15 });
    });

    it('throws DateParseError for empty or whitespace-only input', () => {
      let error: unknown;
      try {
        parseDate('   ');
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(DateParseError);
      expect(error).toBeInstanceOf(Error);
      expect((error as DateParseError).name).toBe('DateParseError');
      expect((error as DateParseError).message).toBe('Cannot parse date "   ": empty input');
    });

    it('rejects input that does not match YYYY-MM-DD in iso format', () => {
      expect(() => parseDate('15.03.2024')).toThrow('expected YYYY-MM-DD');
      expect(() => parseDate('2024-3-15', 'iso')).toThrow('expected YYYY-MM-DD');
    });

    it('rejects years outside 1900-2999', () => {
      expect(() => parseDate('1899-12-31')).toThrow('year must be between 1900 and 2999');
      expect(() => parseDate('3000-01-01')).toThrow('year must be between 1900 and 2999');
    });

    it('rejects months outside 1-12', () => {
      expect(() => parseDate('2024-00-10')).toThrow('month must be between 1 and 12');
      expect(() => parseDate('2024-13-10')).toThrow('month must be between 1 and 12');
    });

    it('rejects days outside the valid range for the month', () => {
      expect(() => parseDate('2024-01-00')).toThrow('day must be between 1 and 31');
      expect(() => parseDate('2023-02-29')).toThrow('day must be between 1 and 28');
      expect(() => parseDate('2024-04-31')).toThrow('day must be between 1 and 30');
      expect(() => parseDate('2024-04-31')).toThrow(DateParseError);
    });

    it('accepts 29 February in a leap year', () => {
      expect(parseDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    });

    it('parses EU dates with dot and slash separators', () => {
      expect(parseDate('15.03.2024', 'eu')).toEqual({ year: 2024, month: 3, day: 15 });
      expect(parseDate('5/3/2024', 'eu')).toEqual({ year: 2024, month: 3, day: 5 });
    });

    it('rejects malformed input in eu format', () => {
      expect(() => parseDate('2024-03-15', 'eu')).toThrow('expected DD.MM.YYYY or DD/MM/YYYY');
    });

    it('validates EU dates and reports an invalid day', () => {
      expect(() => parseDate('31.04.2024', 'eu')).toThrow('day must be between 1 and 30');
    });

    it('parses US dates as month first', () => {
      expect(parseDate('03/15/2024', 'us')).toEqual({ year: 2024, month: 3, day: 15 });
      expect(() => parseDate('03/15/2024', 'eu')).toThrow('month must be between 1 and 12');
    });

    it('rejects malformed input in us format', () => {
      expect(() => parseDate('03.15.2024', 'us')).toThrow('expected MM/DD/YYYY');
    });
  });

  describe('compareDates', () => {
    it('orders dates by year first', () => {
      expect(compareDates({ year: 2023, month: 12, day: 31 }, { year: 2024, month: 1, day: 1 })).toBeLessThan(0);
      expect(compareDates({ year: 2025, month: 1, day: 1 }, { year: 2024, month: 12, day: 31 })).toBeGreaterThan(0);
    });

    it('orders dates by month when the years are equal', () => {
      expect(compareDates({ year: 2024, month: 1, day: 31 }, { year: 2024, month: 2, day: 1 })).toBeLessThan(0);
      expect(compareDates({ year: 2024, month: 2, day: 1 }, { year: 2024, month: 1, day: 31 })).toBeGreaterThan(0);
    });

    it('compares days when year and month are equal', () => {
      expect(compareDates({ year: 2024, month: 3, day: 10 }, { year: 2024, month: 3, day: 5 })).toBeGreaterThan(0);
      expect(compareDates({ year: 2024, month: 3, day: 5 }, { year: 2024, month: 3, day: 5 })).toBe(0);
    });
  });
});
