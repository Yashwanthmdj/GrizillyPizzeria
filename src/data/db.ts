import { mkdirSync } from "node:fs";
import { createClient, type Client, type InValue } from "@libsql/client";
import { dataDir, dbFile } from "./paths";

let client: Client | null = null;
let boot: Promise<Client> | null = null;
let writes: Promise<unknown> = Promise.resolve();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS outlets (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS menu_items (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS customers (
  phone TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT,
  email TEXT,
  password_hash TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  visits INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_visit INTEGER,
  history TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS otp_challenges (
  phone TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  payload TEXT,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS staff (
  username TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  outlet_id TEXT,
  password_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER
);
CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  outlet_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  outlet_id TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  clock_in INTEGER NOT NULL,
  clock_out INTEGER
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  outlet_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS coupons (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS loyalty (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  phone TEXT NOT NULL,
  template_name TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  sent_at INTEGER
);
CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  provider_message_id TEXT,
  payload TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  checkout_key TEXT,
  fingerprint TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  paid_at INTEGER,
  error TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS payments_checkout_key ON payments(checkout_key) WHERE checkout_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_rz_order ON payments(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_rz_payment ON payments(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_order ON payments(order_id);
CREATE TABLE IF NOT EXISTS razorpay_events (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  razorpay_payment_id TEXT,
  payload TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
`;

export async function getClient() {
  if (client) return client;
  if (!boot) {
    boot = (async () => {
      mkdirSync(dataDir(), { recursive: true });
      const url = `file:${dbFile().replace(/\\/g, "/")}`;
      const db = createClient({ url });
      for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
        await db.execute(stmt);
      }
      try {
        await db.execute("ALTER TABLE customers ADD COLUMN username TEXT");
      } catch {
        /* already present */
      }
      for (const alter of [
        "ALTER TABLE customers ADD COLUMN wa_marketing_consent INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE customers ADD COLUMN wa_marketing_consent_at INTEGER",
        "ALTER TABLE customers ADD COLUMN wa_marketing_consent_source TEXT",
      ]) {
        try {
          await db.execute(alter);
        } catch {
          /* already present */
        }
      }
      client = db;
      return db;
    })();
  }
  return boot;
}

export async function exec(sql: string, args: InValue[] = []) {
  const db = await getClient();
  return db.execute({ sql, args });
}

export function serialize<T>(fn: () => Promise<T>) {
  const run = writes.then(fn, fn);
  writes = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
