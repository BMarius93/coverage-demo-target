import * as barrel from './index';
import * as dateParser from './date-parser';
import * as priceCalculator from './price-calculator';
import * as stringValidator from './string-validator';
import * as ttlCache from './ttl-cache';
import * as userService from './user-service';

describe('index barrel', () => {
  it('re-exports the date-parser API', () => {
    for (const name of ['parseDate', 'formatIso', 'compareDates', 'isLeapYear', 'daysInMonth', 'DateParseError'] as const) {
      expect(barrel[name]).toBe(dateParser[name]);
    }
  });

  it('re-exports the price-calculator API', () => {
    for (const name of ['roundMoney', 'lineDiscount', 'calculateTotal'] as const) {
      expect(barrel[name]).toBe(priceCalculator[name]);
    }
  });

  it('re-exports the string-validator API', () => {
    for (const name of ['isEmail', 'isSlug', 'validatePassword', 'isValidIban', 'toSlug', 'DEFAULT_PASSWORD_POLICY'] as const) {
      expect(barrel[name]).toBe(stringValidator[name]);
    }
  });

  it('re-exports TtlCache', () => {
    expect(typeof barrel.TtlCache).toBe('function');
    expect(barrel.TtlCache).toBe(ttlCache.TtlCache);
  });

  it('re-exports user-service classes', () => {
    expect(barrel.UserService).toBe(userService.UserService);
    expect(barrel.UserNotFoundError).toBe(userService.UserNotFoundError);
    expect(barrel.UserServiceError).toBe(userService.UserServiceError);
  });

  it('exposes working functions through the barrel', () => {
    expect(barrel.roundMoney(1.005)).toBe(1.01);
    expect(barrel.isLeapYear(2024)).toBe(true);
    expect(barrel.isSlug('a-b')).toBe(true);
  });

  it('exports error classes that extend Error', () => {
    expect(barrel.DateParseError.prototype).toBeInstanceOf(Error);
    expect(barrel.UserNotFoundError.prototype).toBeInstanceOf(Error);
    expect(barrel.UserServiceError.prototype).toBeInstanceOf(Error);
  });

  it('does not expose unexpected runtime keys', () => {
    expect(Object.keys(barrel).sort()).toEqual(
      [
        'parseDate', 'formatIso', 'compareDates', 'isLeapYear', 'daysInMonth', 'DateParseError',
        'roundMoney', 'lineDiscount', 'calculateTotal',
        'isEmail', 'isSlug', 'validatePassword', 'isValidIban', 'toSlug', 'DEFAULT_PASSWORD_POLICY',
        'TtlCache',
        'UserService', 'UserNotFoundError', 'UserServiceError',
      ].sort(),
    );
  });
});
