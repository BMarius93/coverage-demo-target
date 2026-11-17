export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

export interface PasswordPolicy {
  minLength: number;
  requireDigit: boolean;
  requireUppercase: boolean;
  requireSymbol: boolean;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireDigit: true,
  requireUppercase: true,
  requireSymbol: false,
};

export function validatePassword(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): ValidationResult {
  const errors: string[] = [];
  if (password.length < policy.minLength) {
    errors.push(`must be at least ${policy.minLength} characters`);
  }
  if (policy.requireDigit && !/\d/.test(password)) {
    errors.push('must contain a digit');
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('must contain an uppercase letter');
  }
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('must contain a symbol');
  }
  if (/\s/.test(password)) {
    errors.push('must not contain whitespace');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates an IBAN using the ISO 13616 mod-97 check.
 */
export function isValidIban(value: string): boolean {
  const iban = value.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) {
    return false;
  }
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const code = char >= 'A' && char <= 'Z' ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of code) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

export function toSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
