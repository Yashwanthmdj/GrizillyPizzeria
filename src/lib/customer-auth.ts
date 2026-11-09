export const CUSTOMER_PASSWORD_HINT = "4–32 characters, with a capital, a number and a symbol.";

export function customerPasswordIssue(plain: string): string | null {
  if (plain.length < 4 || plain.length > 32) return "Use 4–32 characters.";
  if (!/[A-Z]/.test(plain)) return "Add a capital letter.";
  if (!/\d/.test(plain)) return "Add a number.";
  if (!/[^A-Za-z0-9]/.test(plain)) return "Add a symbol.";
  return null;
}
