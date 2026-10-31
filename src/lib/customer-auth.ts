export const CUSTOMER_PASSWORD_HINT = "4–9 characters, with a capital, a number and a symbol.";

export function customerPasswordIssue(plain: string): string | null {
  if (
    plain.length <= 3 ||
    plain.length >= 10 ||
    !/[A-Z]/.test(plain) ||
    !/\d/.test(plain) ||
    !/[^A-Za-z0-9]/.test(plain)
  ) {
    return CUSTOMER_PASSWORD_HINT;
  }
  return null;
}
