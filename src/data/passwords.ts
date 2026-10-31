import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { customerPasswordIssue } from "@/lib/customer-auth";

const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

function scrypt(plain: string, salt: string, keyLen: number, opts: { N: number; r: number; p: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCb(plain, salt, keyLen, opts, (err, key) => {
      if (err) reject(err);
      else resolve(key as Buffer);
    });
  });
}

export async function hashPassword(plain: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(plain, salt, KEY_LEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4]!;
  const expected = Buffer.from(parts[5]!, "hex");
  if (!salt || expected.length !== KEY_LEN) return false;
  const actual = await scrypt(plain, salt, expected.length, { N: n, r, p });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function staffSecretFingerprint(parts: string[]) {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

export function hashOtp(phone: string, code: string) {
  return createHash("sha256").update(`gp-otp:${phone}:${code}`).digest("hex");
}

export function assertUsername(raw: string) {
  const u = raw.trim();
  if (!u) throw new Error("Enter a username.");
  return u;
}

export function assertStaffPassword(plain: string) {
  if (plain.length < 10) throw new Error("Staff password is too short.");
}

/** Demo shop OTP — used until WhatsApp is wired. */
export const DEMO_OTP = "1234";

export function assertCustomerPassword(plain: string) {
  const issue = customerPasswordIssue(plain);
  if (issue) throw new Error(issue);
}
