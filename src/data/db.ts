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
