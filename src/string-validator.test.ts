import { isEmail, isSlug, isValidIban, toSlug, validatePassword } from './string-validator';

describe('isEmail', () => {
  it('accepts a simple address', () => {
    expect(isEmail('ada@example.com')).toBe(true);
  });
});

describe('isSlug', () => {
  it('accepts lowercase alphanumeric segments joined by single hyphens', () => {
    expect(isSlug('hello-world-42')).toBe(true);
  });

  it.each(['Hello', 'a--b', '-a', 'a-'])('rejects %p', (value) => {
    expect(isSlug(value)).toBe(false);
  });
});

describe('validatePassword', () => {
  it('accepts a compliant password using the default policy', () => {
    expect(validatePassword('Abcdefg1')).toEqual({ valid: true, errors: [] });
  });

  it('reports too-short, missing digit and missing uppercase under the default policy', () => {
    expect(validatePassword('abc')).toEqual({
      valid: false,
      errors: [
        'must be at least 8 characters',
        'must contain a digit',
        'must contain an uppercase letter',
      ],
    });
  });

  it('rejects passwords containing whitespace', () => {
    expect(validatePassword('Abcdef12 x').errors).toEqual(['must not contain whitespace']);
  });

  it('requires a symbol when the policy demands one', () => {
    const policy = { minLength: 8, requireDigit: true, requireUppercase: true, requireSymbol: true };
    expect(validatePassword('Abcdefg1', policy)).toEqual({
      valid: false,
      errors: ['must contain a symbol'],
    });
  });

  it('accepts a password with a symbol when symbols are required', () => {
    const policy = { minLength: 8, requireDigit: true, requireUppercase: true, requireSymbol: true };
    expect(validatePassword('Abcdef1!', policy).valid).toBe(true);
  });

  it('skips digit and uppercase checks when the policy disables them', () => {
    const policy = {
      minLength: 4,
      requireDigit: false,
      requireUppercase: false,
      requireSymbol: false,
    };
    expect(validatePassword('abcd', policy).valid).toBe(true);
    expect(validatePassword('abc', policy).errors).toEqual(['must be at least 4 characters']);
  });
});

describe('isValidIban', () => {
  it.each(['GB82WEST12345698765432', 'DE89370400440532013000'])('accepts %s', (iban) => {
    expect(isValidIban(iban)).toBe(true);
  });

  it('normalises whitespace and lowercase before validating', () => {
    expect(isValidIban('gb82 west 1234 5698 7654 32')).toBe(true);
  });

  it.each(['', 'GB82', '1234WEST12345698765432', 'GB82WEST1234!698765432'])(
    'rejects invalid format %p',
    (value) => {
      expect(isValidIban(value)).toBe(false);
    },
  );

  it('rejects a well-formed IBAN with a wrong checksum', () => {
    expect(isValidIban('GB83WEST12345698765432')).toBe(false);
  });
});

describe('toSlug', () => {
  it('lowercases and joins words with single hyphens', () => {
    expect(toSlug('Hello,   World!! 2024')).toBe('hello-world-2024');
  });

  it('strips diacritics', () => {
    expect(toSlug('Crème Brûlée')).toBe('creme-brulee');
  });

  it('trims leading and trailing separators', () => {
    expect(toSlug('--Already Slugged--')).toBe('already-slugged');
    expect(toSlug('!!!')).toBe('');
  });
});
