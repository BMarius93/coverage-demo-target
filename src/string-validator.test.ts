import { isEmail, isSlug, isValidIban, toSlug, validatePassword } from './string-validator';

describe('isEmail', () => {
  it('accepts a simple address', () => {
    expect(isEmail('ada@example.com')).toBe(true);
  });
});

describe('isSlug', () => {
  it('accepts lowercase alphanumeric words joined by single dashes', () => {
    expect(isSlug('hello-world-2')).toBe(true);
  });

  it.each(['Hello', 'a--b', '-a', 'a-', 'a b', ''])('rejects %p', (value) => {
    expect(isSlug(value)).toBe(false);
  });
});

describe('validatePassword', () => {
  it('accepts a compliant password with the default policy', () => {
    expect(validatePassword('Abcdefg1')).toEqual({ valid: true, errors: [] });
  });

  it('reports too short, missing digit and missing uppercase', () => {
    const result = validatePassword('abc');
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'must be at least 8 characters',
      'must contain a digit',
      'must contain an uppercase letter',
    ]);
  });

  it('rejects passwords containing whitespace', () => {
    expect(validatePassword('Abcdefg1 x')).toEqual({
      valid: false,
      errors: ['must not contain whitespace'],
    });
  });

  it('requires a symbol when the policy demands it', () => {
    const policy = { minLength: 8, requireDigit: true, requireUppercase: true, requireSymbol: true };
    expect(validatePassword('Abcdefg1', policy).errors).toEqual(['must contain a symbol']);
    expect(validatePassword('Abcdefg1!', policy)).toEqual({ valid: true, errors: [] });
  });

  it('skips digit, uppercase and symbol checks when the policy disables them', () => {
    const policy = { minLength: 3, requireDigit: false, requireUppercase: false, requireSymbol: false };
    expect(validatePassword('abc', policy)).toEqual({ valid: true, errors: [] });
  });

  it('reports the custom minimum length in the error message', () => {
    const policy = { minLength: 12, requireDigit: false, requireUppercase: false, requireSymbol: false };
    expect(validatePassword('short', policy).errors).toEqual(['must be at least 12 characters']);
  });
});

describe('isValidIban', () => {
  it('accepts a valid compact IBAN', () => {
    expect(isValidIban('DE89370400440532013000')).toBe(true);
  });

  it('normalises spaces and lowercase before validating', () => {
    expect(isValidIban('gb82 west 1234 5698 7654 32')).toBe(true);
  });

  it('rejects an IBAN with a wrong check digit', () => {
    expect(isValidIban('GB00WEST12345698765432')).toBe(false);
    expect(isValidIban('DE89370400440532013001')).toBe(false);
  });

  it.each(['', '12GB345', 'GB82WEST', 'GB82-WEST-1234-5698-7654-32'])(
    'rejects malformed input %p',
    (value) => {
      expect(isValidIban(value)).toBe(false);
    },
  );
});

describe('toSlug', () => {
  it('lowercases and joins words with single dashes', () => {
    expect(toSlug('Hello World')).toBe('hello-world');
    expect(toSlug('a  &  b')).toBe('a-b');
  });

  it('strips diacritics', () => {
    expect(toSlug('Crème Brûlée')).toBe('creme-brulee');
  });

  it('trims leading and trailing separators', () => {
    expect(toSlug('  --Hello, World!--  ')).toBe('hello-world');
    expect(toSlug('!!!')).toBe('');
  });

  it('produces output accepted by isSlug', () => {
    expect(isSlug(toSlug('My First Post 2024'))).toBe(true);
  });
});
