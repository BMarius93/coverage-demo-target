export class DateParseError extends Error {
  constructor(input: string, reason: string) {
    super(`Cannot parse date "${input}": ${reason}`);
    this.name = 'DateParseError';
  }
}

export interface SimpleDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const EU_PATTERN = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/;
const US_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export type DateFormat = 'iso' | 'eu' | 'us';

export function isLeapYear(year: number): boolean {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    throw new RangeError(`Month out of range: ${month}`);
  }
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function validate(input: string, date: SimpleDate): SimpleDate {
  if (date.year < 1900 || date.year > 2999) {
    throw new DateParseError(input, 'year must be between 1900 and 2999');
  }
  if (date.month < 1 || date.month > 12) {
    throw new DateParseError(input, 'month must be between 1 and 12');
  }
  const maxDay = daysInMonth(date.year, date.month);
  if (date.day < 1 || date.day > maxDay) {
    throw new DateParseError(input, `day must be between 1 and ${maxDay}`);
  }
  return date;
}

/**
 * Parses a date string in ISO (YYYY-MM-DD), EU (DD.MM.YYYY or DD/MM/YYYY)
 * or US (MM/DD/YYYY) format. Slash-separated dates are ambiguous, so the
 * caller chooses between EU and US with `format`.
 */
export function parseDate(input: string, format: DateFormat = 'iso'): SimpleDate {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new DateParseError(input, 'empty input');
  }

  if (format === 'iso') {
    const match = ISO_PATTERN.exec(trimmed);
    if (!match) throw new DateParseError(input, 'expected YYYY-MM-DD');
    return validate(input, { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) });
  }

  if (format === 'eu') {
    const match = EU_PATTERN.exec(trimmed);
    if (!match) throw new DateParseError(input, 'expected DD.MM.YYYY or DD/MM/YYYY');
    return validate(input, { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) });
  }

  const match = US_PATTERN.exec(trimmed);
  if (!match) throw new DateParseError(input, 'expected MM/DD/YYYY');
  return validate(input, { year: Number(match[3]), month: Number(match[1]), day: Number(match[2]) });
}

export function formatIso(date: SimpleDate): string {
  const mm = String(date.month).padStart(2, '0');
  const dd = String(date.day).padStart(2, '0');
  return `${date.year}-${mm}-${dd}`;
}

export function compareDates(a: SimpleDate, b: SimpleDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}
