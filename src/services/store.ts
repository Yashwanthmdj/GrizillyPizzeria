// INTEGRATION: replace this localStorage demo with the API client.
import { useSyncExternalStore } from "react";
import { buildSeed, DEFAULT_SETTINGS, defaultCoupons } from "./seed";
import type { DB, Session } from "./types";

const DB_KEY = "grizzly-db-v1";
const SESSION_KEY = "grizzly-session-v1";

const emptySession: Session = {
  outletId: null,
  cart: [],
  phone: null,
  staff: null,
  myOrders: [],
  redeemStepId: null,
  couponCode: null,
};

function withDefaults(raw: DB): DB {
  return {
    ...raw,
    version: 2,
    outlets: raw.outlets.map((o) => ({
      ...o,
      phone: o.phone || (o.id === "o2" ? "9000000002" : "9000000001"),
    })),
    coupons: raw.coupons ?? defaultCoupons(),
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    audit: raw.audit ?? [],
    messages: raw.messages ?? [],
  };
}

let db: DB | null = null;
let session: Session | null = null;
const listeners = new Set<() => void>();

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function getDB(): DB {
  if (!db) {
    if (typeof window === "undefined") return (db = buildSeed());
    db = withDefaults(read<DB>(DB_KEY) ?? buildSeed());
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }
  return db;
}
export function getSession(): Session {
  if (!session) {
    const saved = typeof window === "undefined" ? null : read<Session>(SESSION_KEY);
    session = { ...emptySession, ...(saved ?? {}), couponCode: saved?.couponCode ?? null };
  }
  return session;
}

function emit() {
  listeners.forEach((l) => l());
}

export function setDB(fn: (d: DB) => DB) {
  db = fn(getDB());
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  emit();
}
export function setSession(fn: (s: Session) => Session) {
  session = fn(getSession());
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  emit();
}

export function resetDemo() {
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem(SESSION_KEY);
  db = null;
  session = null;
  getDB();
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === DB_KEY) db = null;
    else if (e.key === SESSION_KEY) session = null;
    else return;
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getDB, getDB);
}
export function useSession(): Session {
  return useSyncExternalStore(subscribe, getSession, () => emptySession);
}
