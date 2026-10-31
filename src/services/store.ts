import { useSyncExternalStore } from "react";
import { emptyCatalog } from "./seed";
import type { CartLine, DB, Session, Staff } from "./types";

function normalizeLine(l: CartLine): CartLine {
  return {
    ...l,
    lineId: l.lineId || l.key,
    prepMinutes: l.prepMinutes || 12,
    lineStatus: l.lineStatus || "queued",
  };
}
import { getAuthFn, getShopFn } from "@/services/rpc";

const SESSION_KEY = "grizzly-session-v3";

const emptySession: Session = {
  outletId: null,
  cart: [],
  phone: null,
  customerName: null,
  staff: null,
  myOrders: [],
  redeemStepId: null,
  couponCode: null,
};

let db: DB = emptyCatalog();
let session: Session = { ...emptySession };
let storeReady = false;
const listeners = new Set<() => void>();
let poll: ReturnType<typeof setInterval> | null = null;
let started = false;

function readLocal(): Partial<Session> {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Partial<Session>) : {};
  } catch {
    return {};
  }
}

function persistLocal() {
  if (typeof window === "undefined") return;
  const slim: Partial<Session> = {
    outletId: session.outletId,
    cart: session.cart,
    myOrders: session.myOrders,
    redeemStepId: session.redeemStepId,
    couponCode: session.couponCode,
    kitchenOutlet: session.kitchenOutlet,
    phone: session.phone,
    customerName: session.customerName,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(slim));
}

function emit() {
  listeners.forEach((l) => l());
}

export function getDB(): DB {
  return db;
}

export function getSession(): Session {
  return session;
}

export function setSession(fn: (s: Session) => Session) {
  session = fn(session);
  persistLocal();
  emit();
}

export async function refreshShop() {
  try {
    const [snap, auth] = await Promise.all([getShopFn(), getAuthFn()]);
    db = {
      ...snap,
      workers: snap.workers ?? [],
      attendance: snap.attendance ?? [],
    };
    session = {
      ...session,
      phone: auth.phone,
      customerName: auth.customerName,
      staff: (auth.staff as Staff | null) ?? null,
    };
    storeReady = true;
    persistLocal();
    emit();
  } catch (error) {
    console.error(error);
    storeReady = true;
    emit();
  }
}

export function bootStore() {
  if (typeof window === "undefined" || started) return;
  started = true;
  const saved = readLocal();
  session = {
    ...emptySession,
    ...saved,
    staff: null,
    cart: (saved.cart ?? []).map(normalizeLine),
  };
  void refreshShop();
  poll = setInterval(() => void refreshShop(), 4000);
}

export function teardownStore() {
  if (poll) clearInterval(poll);
  poll = null;
  started = false;
}

function subscribe(l: () => void) {
  listeners.add(l);
  bootStore();
  return () => {
    listeners.delete(l);
  };
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getDB, emptyCatalog);
}

export function useSession(): Session {
  return useSyncExternalStore(subscribe, getSession, () => emptySession);
}

export function useStoreReady() {
  return useSyncExternalStore(
    subscribe,
    () => storeReady,
    () => false,
  );
}
