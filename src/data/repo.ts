import { uid } from "@/lib/id";
import { billOptions, cartSubtotal, computeBill, unitPrice, validateCoupon } from "@/services/pricing";
import { canTransition } from "@/services/orders";
import { canOrder } from "@/services/outlet-status";
import { evaluateScan } from "@/services/scan";
import { findBySlug } from "@/services/slug";
import {
  DEFAULT_LOYALTY,
  DEFAULT_SETTINGS,
  defaultCoupons,
  defaultWorkers,
  MENU,
  OUTLETS,
} from "@/services/seed";
import { cookQueue, minutesPerOrder, waitForNewOrder } from "@/services/wait";
import { buildAnalytics, type Period } from "@/services/analytics";
import type {
  AttendanceRecord,
  AuditEntry,
  CartLine,
  ContactMessage,
  Coupon,
  Customer,
  DB,
  KitchenWorker,
  LineStatus,
  LoyaltyRule,
  MenuItem,
  Order,
  OrderStatus,
  Outlet,
  PaymentMethod,
  ShopSettings,
  Staff,
} from "@/services/types";
import { exec, parseJson, serialize } from "./db";
import {
  assertCustomerPassword,
  assertStaffPassword,
  assertUsername,
  generateOtp,
  hashOtp,
  hashPassword,
  staffSecretFingerprint,
  verifyPassword,
} from "./passwords";
import { sendWhatsAppOtp } from "./whatsapp";
import { enqueueOrderConfirmationSafe } from "./whatsapp-outbox";
import type { AuthSession } from "./session";

const FAIL_LIMIT = 5;
const LOCK_MS = 15 * 60_000;
const OTP_TTL_MS = 5 * 60_000;
const OTP_RESEND_MS = 45_000;
const OTP_DIGITS = 6;
const hits = new Map<string, number[]>();

function rateOk(key: string, limit = 10, windowMs = 10 * 60_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length <= limit;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Someone";
}

function rec(row: object) {
  return row as Record<string, unknown>;
}
function s(row: object, key: string) {
  const v = rec(row)[key];
  return v == null ? "" : String(v);
}
function n(row: object, key: string) {
  return Number(rec(row)[key] ?? 0);
}
function maybeS(row: object, key: string) {
  const v = rec(row)[key];
  return v == null ? undefined : String(v);
}
function maybeN(row: object, key: string) {
  const v = rec(row)[key];
  return v == null ? undefined : Number(v);
}
function env(key: string) {
  const v = process.env[key]?.trim();
  return v ? v : undefined;
}

async function meta(key: string) {
  const rs = await exec("SELECT value FROM meta WHERE key = ?", [key]);
  const row = rs.rows[0];
  return row ? maybeS(row, "value") ?? null : null;
}

async function setMeta(key: string, value: string) {
  await exec("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
    key,
    value,
  ]);
}

export async function ensureSeed() {
  return serialize(async () => {
    const ready = await meta("seeded");
    if (!ready) {
      for (const o of OUTLETS) {
        await exec("INSERT OR REPLACE INTO outlets (id, data) VALUES (?, ?)", [o.id, JSON.stringify(o)]);
      }
      for (const c of defaultCoupons()) {
        await exec("INSERT OR REPLACE INTO coupons (id, data) VALUES (?, ?)", [c.id, JSON.stringify(c)]);
      }
      await exec("INSERT OR REPLACE INTO settings (id, data) VALUES ('shop', ?)", [JSON.stringify(DEFAULT_SETTINGS)]);
      await exec("INSERT OR REPLACE INTO loyalty (id, data) VALUES ('shop', ?)", [JSON.stringify(DEFAULT_LOYALTY)]);
      for (const w of defaultWorkers()) {
        await exec(
          "INSERT OR REPLACE INTO workers (id, outlet_id, name, phone, role, active) VALUES (?, ?, ?, ?, ?, ?)",
          [w.id, w.outletId, w.name, w.phone ?? null, w.role, w.active ? 1 : 0],
        );
      }
      await setMeta("nextNumber", "101");
      await setMeta("seeded", "4");
    }
    const catalog = await meta("catalog");
    if (catalog !== "board-v5-dip-photos-2026") {
      await exec("DELETE FROM menu_items");
      for (const m of MENU) {
        await exec("INSERT OR REPLACE INTO menu_items (id, data) VALUES (?, ?)", [
          m.id,
          JSON.stringify({ ...m, veg: true }),
        ]);
      }
      await exec("INSERT OR REPLACE INTO settings (id, data) VALUES ('shop', ?)", [JSON.stringify(DEFAULT_SETTINGS)]);
      await exec("INSERT OR REPLACE INTO loyalty (id, data) VALUES ('shop', ?)", [JSON.stringify(DEFAULT_LOYALTY)]);
      await setMeta("catalog", "board-v5-dip-photos-2026");
    }
    await syncStaffPasswords();
  });
}

function staffSecrets() {
  return [
    {
      username: (env("GRIZZLY_OWNER_USER") ?? "owner").toLowerCase(),
      name: "Owner",
      role: "owner" as const,
      outletId: undefined as string | undefined,
      password: env("GRIZZLY_OWNER_PASSWORD") ?? "Grizzly#Owner26",
    },
    {
      username: (env("GRIZZLY_KITCHEN1_USER") ?? "kitchen.outlet1").toLowerCase(),
      name: "Outlet 1 Kitchen",
      role: "kitchen" as const,
      outletId: "o1",
      password: env("GRIZZLY_KITCHEN1_PASSWORD") ?? "Grizzly#Kitchen1",
    },
    {
      username: (env("GRIZZLY_KITCHEN2_USER") ?? "kitchen.outlet2").toLowerCase(),
      name: "Outlet 2 Kitchen",
      role: "kitchen" as const,
      outletId: "o2",
      password: env("GRIZZLY_KITCHEN2_PASSWORD") ?? "Grizzly#Kitchen2",
    },
  ];
}

async function syncStaffPasswords() {
  const secrets = staffSecrets();
  const fp = staffSecretFingerprint(secrets.map((s) => `${s.username}:${s.password}:${s.role}:${s.outletId ?? ""}`));
  if ((await meta("staff_fp")) === fp) return;
  for (const row of secrets) {
    // Customer signup also hits ensureSeed; keep staff sync from blocking shoppers.
    if (row.password.length < 10) {
      console.error("[staff] password env value is too short after dotenv parse; quote values that contain #");
      continue;
    }
    assertStaffPassword(row.password);
    const hash = await hashPassword(row.password);
    await exec(
      `INSERT INTO staff (username, name, role, outlet_id, password_hash, failed_attempts, locked_until)
       VALUES (?, ?, ?, ?, ?, 0, NULL)
       ON CONFLICT(username) DO UPDATE SET
         name = excluded.name,
         role = excluded.role,
         outlet_id = excluded.outlet_id,
         password_hash = excluded.password_hash`,
      [row.username, row.name, row.role, row.outletId ?? null, hash],
    );
  }
  await setMeta("staff_fp", fp);
}

async function loadOutlets(): Promise<Outlet[]> {
  const rs = await exec("SELECT data FROM outlets");
  return rs.rows.map((r) => parseJson<Outlet>(s(r, "data"), OUTLETS[0]!));
}

async function loadMenu(): Promise<MenuItem[]> {
  const rs = await exec("SELECT data FROM menu_items");
  return rs.rows
    .map((r) => parseJson<MenuItem>(s(r, "data"), MENU[0]!))
    .map((m) => ({ ...m, veg: true }));
}

async function loadOrders(): Promise<Order[]> {
  const rs = await exec("SELECT data FROM orders ORDER BY created_at DESC");
  return rs.rows.map((r) => parseJson<Order>(s(r, "data"), null as unknown as Order)).filter(Boolean);
}

async function loadCoupons(): Promise<Coupon[]> {
  const rs = await exec("SELECT data FROM coupons");
  return rs.rows.map((r) => parseJson<Coupon>(s(r, "data"), null as unknown as Coupon)).filter(Boolean);
}

async function loadSettings(): Promise<ShopSettings> {
  const rs = await exec("SELECT data FROM settings WHERE id = 'shop'");
  return {
    ...DEFAULT_SETTINGS,
    ...parseJson(rs.rows[0] ? s(rs.rows[0], "data") : null, DEFAULT_SETTINGS),
  };
}

async function loadLoyalty(): Promise<LoyaltyRule> {
  const rs = await exec("SELECT data FROM loyalty WHERE id = 'shop'");
  return parseJson(rs.rows[0] ? s(rs.rows[0], "data") : null, DEFAULT_LOYALTY);
}

async function loadCustomers(): Promise<Customer[]> {
  const rs = await exec(
    `SELECT phone, name, username, email, points, lifetime_points, visits, streak, last_visit, history,
            wa_marketing_consent, wa_marketing_consent_at, wa_marketing_consent_source
     FROM customers`,
  );
  return rs.rows.map((r) => ({
    phone: s(r, "phone"),
    name: s(r, "name"),
    username: maybeS(r, "username"),
    email: maybeS(r, "email"),
    points: n(r, "points"),
    lifetimePoints: n(r, "lifetime_points"),
    visits: n(r, "visits"),
    streak: n(r, "streak"),
    lastVisit: maybeN(r, "last_visit"),
    history: parseJson(s(r, "history"), [] as Customer["history"]),
    waMarketingConsent: n(r, "wa_marketing_consent") === 1,
    waMarketingConsentAt: maybeN(r, "wa_marketing_consent_at"),
    waMarketingConsentSource: maybeS(r, "wa_marketing_consent_source") ?? undefined,
  }));
}

async function loadStaffPublic(): Promise<Staff[]> {
  const rs = await exec("SELECT username, name, role, outlet_id FROM staff");
  return rs.rows.map((r) => ({
    username: s(r, "username"),
    name: s(r, "name"),
    role: s(r, "role") as Staff["role"],
    outletId: maybeS(r, "outlet_id"),
  }));
}

async function loadWorkers(): Promise<KitchenWorker[]> {
  const rs = await exec("SELECT id, outlet_id, name, phone, role, active FROM workers");
  return rs.rows.map((r) => ({
    id: s(r, "id"),
    outletId: s(r, "outlet_id"),
    name: s(r, "name"),
    phone: maybeS(r, "phone"),
    role: s(r, "role") as KitchenWorker["role"],
    active: n(r, "active") === 1,
  }));
}

async function loadAttendance(): Promise<AttendanceRecord[]> {
  const rs = await exec(
    "SELECT id, worker_id, outlet_id, worker_name, clock_in, clock_out FROM attendance ORDER BY clock_in DESC",
  );
  return rs.rows.map((r) => ({
    id: s(r, "id"),
    workerId: s(r, "worker_id"),
    outletId: s(r, "outlet_id"),
    workerName: s(r, "worker_name"),
    clockIn: n(r, "clock_in"),
    clockOut: maybeN(r, "clock_out"),
  }));
}

async function loadAudit(): Promise<AuditEntry[]> {
  const rs = await exec("SELECT id, at, actor, action, detail FROM audit ORDER BY at DESC LIMIT 400");
  return rs.rows.map((r) => ({
    id: s(r, "id"),
    at: n(r, "at"),
    actor: s(r, "actor"),
    action: s(r, "action"),
    detail: s(r, "detail"),
  }));
}

async function loadMessages(): Promise<ContactMessage[]> {
  const rs = await exec("SELECT data FROM messages ORDER BY id DESC LIMIT 200");
  return rs.rows.map((r) => parseJson<ContactMessage>(s(r, "data"), null as unknown as ContactMessage)).filter(Boolean);
}

async function stamp(actor: string, action: string, detail: string) {
  await exec("INSERT INTO audit (id, at, actor, action, detail) VALUES (?, ?, ?, ?, ?)", [
    `aud_${uid()}`,
    Date.now(),
    actor,
    action,
    detail,
  ]);
}

function withWait(outlets: Outlet[], orders: Order[]) {
  return outlets.map((o) => {
    const per = minutesPerOrder(o);
    const queueLength = cookQueue(orders, o.id).length;
    return {
      ...o,
      minutesPerOrder: per,
      fallbackWaitMinutes: per,
      queueLength,
      waitMinutes: (queueLength + 1) * per,
    };
  });
}

function publicOrder(o: Order): Order {
  return {
    ...o,
    phone: "",
    customerName: firstName(o.customerName),
    qrToken: undefined,
    notes: undefined,
  };
}

async function attachShopper(
  db: DB,
  customer: AuthSession | null,
  orders: Order[],
): Promise<DB> {
  if (!customer?.phone) return db;
  if (db.customers.some((c) => c.phone === customer.phone)) return db;
  const me = (await loadCustomers()).filter((c) => c.phone === customer.phone);
  const mine = orders.filter((o) => o.phone === customer.phone);
  const seen = new Set(db.orders.map((o) => o.id));
  return {
    ...db,
    customers: me,
    orders: [...mine.filter((o) => !seen.has(o.id)), ...db.orders],
  };
}

export async function snapshot(ident: {
  staff?: AuthSession | null;
  customer?: AuthSession | null;
}): Promise<DB> {
  await ensureSeed();
  const staff = ident.staff?.kind === "staff" ? ident.staff : null;
  const customer = ident.customer?.kind === "customer" ? ident.customer : null;
  const [outlets, menu, orders, coupons, settings, loyalty, workers, attendance] = await Promise.all([
    loadOutlets(),
    loadMenu(),
    loadOrders(),
    loadCoupons(),
    loadSettings(),
    loadLoyalty(),
    loadWorkers(),
    loadAttendance(),
  ]);
  const nextNumber = Number((await meta("nextNumber")) ?? 101);
  const waited = withWait(outlets, orders);

  if (staff?.role === "owner") {
    const [customers, staffRows, audit, messages] = await Promise.all([
      loadCustomers(),
      loadStaffPublic(),
      loadAudit(),
      loadMessages(),
    ]);
    return {
      version: 3,
      outlets: waited,
      menu,
      orders,
      customers,
      coupons,
      settings,
      loyalty,
      audit,
      messages,
      staff: staffRows,
      workers,
      attendance,
      nextNumber,
    };
  }

  if (staff) {
    const outletId = staff.outletId;
    const scoped = orders.filter((o) => !outletId || o.outletId === outletId);
    const kitchen: DB = {
      version: 3,
      outlets: waited,
      menu,
      orders: scoped,
      customers: [],
      coupons,
      settings,
      loyalty,
      audit: [],
      messages: [],
      staff: [],
      workers: workers.filter((w) => !outletId || w.outletId === outletId),
      attendance: attendance.filter((a) => !outletId || a.outletId === outletId),
      nextNumber,
    };
    return attachShopper(kitchen, customer, orders);
  }

  const mine = customer?.phone ? orders.filter((o) => o.phone === customer.phone) : [];
  const mineIds = new Set(mine.map((o) => o.id));
  const feed = orders
    .filter((o) => !mineIds.has(o.id) && Date.now() - o.createdAt < 4 * 3600_000)
    .slice(0, 20);
  const me = customer?.phone ? (await loadCustomers()).filter((c) => c.phone === customer.phone) : [];
  return {
    version: 3,
    outlets: waited,
    menu,
    orders: [...mine, ...feed.map(publicOrder)],
    customers: me,
    coupons,
    settings,
    loyalty,
    audit: [],
    messages: [],
    staff: [],
    workers: [],
    attendance: [],
    nextNumber,
  };
}

export async function staffLogin(username: string, password: string): Promise<Staff> {
  await ensureSeed();
  const u = username.trim().toLowerCase();
  if (!rateOk(`staff:${u}`)) throw new Error("Too many attempts. Wait a few minutes.");
  const rs = await exec(
    "SELECT username, name, role, outlet_id, password_hash, failed_attempts, locked_until FROM staff WHERE username = ?",
    [u],
  );
  const row = rs.rows[0];
  if (!row) throw new Error("Wrong username or password.");
  const locked = maybeN(row, "locked_until") ?? 0;
  if (locked > Date.now()) throw new Error("This account is locked. Try again later.");
  const ok = await verifyPassword(password, s(row, "password_hash"));
  if (!ok) {
    const fails = n(row, "failed_attempts") + 1;
    const lock = fails >= FAIL_LIMIT ? Date.now() + LOCK_MS : null;
    await exec("UPDATE staff SET failed_attempts = ?, locked_until = ? WHERE username = ?", [fails, lock, u]);
    throw new Error("Wrong username or password.");
  }
  await exec("UPDATE staff SET failed_attempts = 0, locked_until = NULL WHERE username = ?", [u]);
  await stamp(s(row, "name"), "auth.staff", "Signed in");
  return {
    username: s(row, "username"),
    name: s(row, "name"),
    role: s(row, "role") as Staff["role"],
    outletId: maybeS(row, "outlet_id"),
  };
}

async function findCustomerRow(login: string) {
  const raw = login.trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return exec("SELECT phone, name, username, password_hash FROM customers WHERE phone = ?", [digits]);
  }
  return exec("SELECT phone, name, username, password_hash FROM customers WHERE lower(username) = ?", [
    raw.toLowerCase(),
  ]);
}

export async function customerPasswordLogin(input: { username: string; password: string }) {
  await ensureSeed();
  const login = input.username.trim();
  if (!login) throw new Error("Enter your username.");
  if (!input.password) throw new Error("Enter your password.");
  if (!rateOk(`cust-login:${login.toLowerCase()}`, 8, 10 * 60_000)) {
    throw new Error("Too many attempts. Wait a few minutes.");
  }
  const rs = await findCustomerRow(login);
  const row = rs.rows[0];
  if (!row) throw new Error("No account with that username. Create one.");
  const ok = await verifyPassword(input.password, s(row, "password_hash"));
  if (!ok) throw new Error("Wrong username or password.");
  return {
    phone: s(row, "phone"),
    name: s(row, "name"),
    username: maybeS(row, "username") ?? login.toLowerCase(),
  };
}

async function assertOtpCooldown(phone: string) {
  const prev = await exec("SELECT sent_at FROM otp_challenges WHERE phone = ?", [phone]);
  const row = prev.rows[0];
  if (!row) return;
  const wait = OTP_RESEND_MS - (Date.now() - n(row, "sent_at"));
  if (wait > 0) {
    throw new Error(`Wait ${Math.ceil(wait / 1000)}s before requesting another code.`);
  }
}

async function issueOtpChallenge(input: {
  phone: string;
  username: string;
  purpose: "register" | "reset" | "login";
  payload: string | null;
}) {
  if (!rateOk(`otp:${input.phone}`, 8, 10 * 60_000)) {
    throw new Error("Too many OTP requests. Wait a few minutes.");
  }
  await assertOtpCooldown(input.phone);

  const code = generateOtp(OTP_DIGITS);
  const now = Date.now();
  await exec(
    `INSERT INTO otp_challenges (phone, username, purpose, code_hash, payload, expires_at, attempts, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(phone) DO UPDATE SET
       username = excluded.username,
       purpose = excluded.purpose,
       code_hash = excluded.code_hash,
       payload = excluded.payload,
       expires_at = excluded.expires_at,
       attempts = 0,
       sent_at = excluded.sent_at`,
    [input.phone, input.username, input.purpose, hashOtp(input.phone, code), input.payload, now + OTP_TTL_MS, now],
  );

  let via: "whatsapp" | "dev" = "dev";
  try {
    via = await sendWhatsAppOtp(input.phone, code);
  } catch {
    await exec("DELETE FROM otp_challenges WHERE phone = ?", [input.phone]);
    throw new Error("Could not send the WhatsApp code. Try again shortly.");
  }

  return { phone: input.phone, via, resendAfterSec: Math.ceil(OTP_RESEND_MS / 1000) };
}

export async function requestCustomerOtp(input: {
  username: string;
  phone?: string | undefined;
  password?: string | undefined;
  intent: "register" | "reset";
}) {
  await ensureSeed();
  let phone = (input.phone ?? "").replace(/\D/g, "");
  let username = input.username.trim().toLowerCase();
  let payload: string | null = null;

  if (input.intent === "register") {
    username = assertUsername(input.username);
    if (phone.length !== 10) throw new Error("Enter a 10-digit phone number.");
    assertCustomerPassword(input.password ?? "");
    const byPhone = await exec("SELECT phone FROM customers WHERE phone = ?", [phone]);
    if (byPhone.rows.length) throw new Error("That phone already has an account. Sign in.");
    const byUser = await exec("SELECT phone FROM customers WHERE lower(username) = ?", [username]);
    if (byUser.rows.length) throw new Error("That username is taken.");
    payload = JSON.stringify({
      username,
      name: username,
      passwordHash: await hashPassword(input.password!),
    });
  } else {
    const rs = await findCustomerRow(input.username);
    const row = rs.rows[0];
    if (!row) throw new Error("No account with that username.");
    phone = s(row, "phone");
    username = maybeS(row, "username") ?? username;
    payload = JSON.stringify({ username });
  }

  return issueOtpChallenge({ phone, username, purpose: input.intent, payload });
}

/** Phone OTP sign-in for existing customers (WhatsApp code). */
export async function requestPhoneLoginOtp(input: { phone: string }) {
  await ensureSeed();
  const phone = input.phone.replace(/\D/g, "");
  if (phone.length !== 10) throw new Error("Enter a 10-digit phone number.");

  // Generic response path: still require an account, but use a bland error.
  const rs = await exec("SELECT phone, username, name FROM customers WHERE phone = ?", [phone]);
  const row = rs.rows[0];
  if (!row) throw new Error("No account for that phone. Create an account first.");
  const username = maybeS(row, "username") ?? phone;

  return issueOtpChallenge({
    phone,
    username,
    purpose: "login",
    payload: JSON.stringify({ username, name: s(row, "name") }),
  });
}

export async function verifyCustomerOtp(input: {
  phone: string;
  code: string;
  newPassword?: string | undefined;
}) {
  await ensureSeed();
  const phone = input.phone.replace(/\D/g, "");
  const code = input.code.replace(/\D/g, "");
  if (phone.length !== 10 || code.length !== OTP_DIGITS) {
    throw new Error(`Enter the ${OTP_DIGITS}-digit code.`);
  }

  return serialize(async () => {
    const rs = await exec(
      "SELECT username, purpose, code_hash, payload, expires_at, attempts FROM otp_challenges WHERE phone = ?",
      [phone],
    );
    const row = rs.rows[0];
    if (!row) throw new Error("Ask for a new code first.");
    if (n(row, "expires_at") < Date.now()) {
      await exec("DELETE FROM otp_challenges WHERE phone = ?", [phone]);
      throw new Error("That code expired. Request a new one.");
    }
    const tries = n(row, "attempts") + 1;
    if (tries > 5) {
      await exec("DELETE FROM otp_challenges WHERE phone = ?", [phone]);
      throw new Error("Too many tries. Request a new code.");
    }
    if (hashOtp(phone, code) !== s(row, "code_hash")) {
      await exec("UPDATE otp_challenges SET attempts = ? WHERE phone = ?", [tries, phone]);
      throw new Error("Wrong code. Try again.");
    }
    // Consume immediately (concurrency-safe within serialize queue).
    await exec("DELETE FROM otp_challenges WHERE phone = ?", [phone]);

    const purpose = s(row, "purpose");
    const username = s(row, "username");
    if (purpose === "register") {
      const payload = parseJson<{ username: string; name: string; passwordHash: string }>(
        maybeS(row, "payload") ?? null,
        { username, name: username, passwordHash: "" },
      );
      if (!payload.passwordHash) throw new Error("Registration expired. Start again.");
      await exec(
        `INSERT INTO customers (phone, name, username, email, password_hash, points, lifetime_points, visits, streak, history)
         VALUES (?, ?, ?, NULL, ?, 0, 0, 0, 0, '[]')`,
        [phone, payload.name, payload.username, payload.passwordHash],
      );
      return { phone, name: payload.name, username: payload.username };
    }
    if (purpose === "reset") {
      assertCustomerPassword(input.newPassword ?? "");
      const hash = await hashPassword(input.newPassword!);
      await exec("UPDATE customers SET password_hash = ? WHERE phone = ?", [hash, phone]);
    }
    const user = await exec("SELECT phone, name, username FROM customers WHERE phone = ?", [phone]);
    const u = user.rows[0];
    if (!u) throw new Error("No account for that phone.");
    return { phone, name: s(u, "name"), username: maybeS(u, "username") ?? username };
  });
}

async function saveOrder(order: Order) {
  await exec(
    `INSERT INTO orders (id, number, outlet_id, phone, status, created_at, data)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, data = excluded.data`,
    [order.id, order.number, order.outletId, order.phone, order.status, order.createdAt, JSON.stringify(order)],
  );
}

export async function placeOrder(
  auth: AuthSession | null,
  input: {
    payment: PaymentMethod;
    name: string;
    notes?: string;
    scheduledFor?: number;
    cart: CartLine[];
    outletId: string | null;
    redeemStepId: string | null;
    couponCode: string | null;
  },
) {
  const phone = auth?.kind === "customer" ? auth.phone : undefined;
  if (!phone) throw new Error("Sign in to place an order.");
  if (!input.outletId || !input.cart.length) throw new Error("Missing outlet or cart.");
  return serialize(async () => {
    const [outlets, orders, coupons, settings, loyalty, customers] = await Promise.all([
      loadOutlets(),
      loadOrders(),
      loadCoupons(),
      loadSettings(),
      loadLoyalty(),
      loadCustomers(),
    ]);
    const outlet = outlets.find((o) => o.id === input.outletId);
    if (!outlet) throw new Error("Unknown outlet.");
    if (!canOrder(outlet)) throw new Error("This outlet isn't taking orders right now.");
    const subtotal = cartSubtotal(input.cart);
    if (subtotal < settings.minimumOrder) {
      throw new Error(`Minimum order is Rs ${settings.minimumOrder.toLocaleString("en-IN")}.`);
    }
    const customer = customers.find((c) => c.phone === phone);
    let step = loyalty.steps.find((x) => x.id === input.redeemStepId) ?? null;
    if (step && (customer?.points ?? 0) < step.points) step = null;
    const coupon = input.couponCode
      ? (coupons.find((c) => c.code.toLowerCase() === input.couponCode!.toLowerCase()) ?? null)
      : null;
    if (coupon) {
      const check = validateCoupon(coupon, subtotal, Date.now());
      if (!check.ok) throw new Error(check.reason);
    }
    const bill = computeBill(input.cart, loyalty, step, billOptions(settings, coupon));
    const now = Date.now();
    const number = Number((await meta("nextNumber")) ?? 101);
    const lines: CartLine[] = input.cart.map((l) => ({
      ...l,
      lineId: l.lineId || uid(),
      prepMinutes: l.prepMinutes || settings.defaultPrepMinutes,
      lineStatus: "queued",
    }));
    const waitMins = waitForNewOrder(orders, outlet.id, minutesPerOrder(outlet));
    const order: Order = {
      id: `ord_${number}_${uid()}`,
      number,
      outletId: outlet.id,
      customerName: input.name.trim() || auth?.customerName || customer?.name || "Guest",
      phone,
      lines,
      ...bill,
      payment: input.payment,
      paid: input.payment === "online",
      status: "Placed",
      history: [{ status: "Placed", at: now }],
      createdAt: now,
      promisedAt: input.scheduledFor ?? now + waitMins * 6e4,
      waitMinutes: waitMins,
      ...(coupon?.code ? { couponCode: coupon.code } : {}),
      ...(input.scheduledFor ? { scheduledFor: input.scheduledFor } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    };
    await saveOrder(order);
    await setMeta("nextNumber", String(number + 1));
    if (coupon) {
      await exec("INSERT OR REPLACE INTO coupons (id, data) VALUES (?, ?)", [
        coupon.id,
        JSON.stringify({ ...coupon, used: coupon.used + 1 }),
      ]);
    }
    if (step && customer) {
      const nextPoints = customer.points - step.points;
      await exec("UPDATE customers SET points = ?, history = ? WHERE phone = ?", [
        nextPoints,
        JSON.stringify([{ at: now, delta: -step.points, label: `Redeemed ${step.label}` }, ...customer.history]),
        customer.phone,
      ]);
    }
    await stamp(order.customerName, "order.place", `#${order.number} placed (${input.payment})`);
    // WhatsApp confirmation is best-effort and never blocks checkout.
    enqueueOrderConfirmationSafe({
      orderId: order.id,
      phone: order.phone,
      customerName: order.customerName,
      orderNumber: order.number,
      orderTotal: order.total,
    });
    return order;
  });
}

/** Online pickup QR is created only once the kitchen marks the order ready. */
function issuePickupQr(order: Order): Order {
  if (order.status !== "Ready" || order.payment !== "online" || order.qrToken) return order;
  return { ...order, qrToken: uid() + uid() };
}

function syncOrderStatus(order: Order): Order {
  const lines = order.lines;
  if (!lines.length) return issuePickupQr(order);
  if (lines.every((l) => l.lineStatus === "collected")) {
    return { ...order, status: "Collected", qrUsed: true, paid: true };
  }
  const open = lines.filter((l) => l.lineStatus !== "collected");
  if (open.length && open.every((l) => l.lineStatus === "ready")) {
    return issuePickupQr({ ...order, status: "Ready", qrUsed: false });
  }
  if (lines.some((l) => l.lineStatus === "preparing" || l.lineStatus === "ready")) {
    if (order.status === "Placed" || order.status === "Accepted") return { ...order, status: "Preparing" };
  }
  return order;
}

export async function setOrderStatus(auth: AuthSession | null, id: string, status: OrderStatus, reason?: string) {
  requireStaff(auth);
  return serialize(async () => {
    const orders = await loadOrders();
    const current = orders.find((o) => o.id === id);
    if (!current) throw new Error("Order not found.");
    guardOutlet(auth, current.outletId);
    if (status === "Collected") {
      const next = collectReadyLines(current);
      await finishIfCollected(next, auth);
      return next;
    }
    if (!canTransition(current.status, status)) {
      throw new Error(`Can't move an order from ${current.status} to ${status}.`);
    }
    if (status === "Rejected" && !reason?.trim()) throw new Error("A reject reason is required.");
    const now = Date.now();
    let lines = current.lines;
    if (status === "Preparing") {
      lines = lines.map((l) =>
        l.lineStatus === "queued" ? { ...l, lineStatus: "preparing" as const, startedAt: now } : l,
      );
    }
    if (status === "Ready") {
      lines = lines.map((l) =>
        l.lineStatus !== "collected"
          ? { ...l, lineStatus: "ready" as const, readyAt: l.readyAt ?? now }
          : l,
      );
    }
    const next: Order = issuePickupQr({
      ...current,
      status,
      lines,
      rejectReason: reason ?? current.rejectReason,
      history: [...current.history, { status, at: now }],
    });
    await saveOrder(next);
    await stamp(auth?.staffName ?? "Staff", "order.status", `#${next.number} → ${status}${reason ? ` (${reason})` : ""}`);
    return next;
  });
}

export async function setLineReady(auth: AuthSession | null, orderId: string, lineId: string) {
  requireStaff(auth);
  return serialize(async () => {
    const orders = await loadOrders();
    const current = orders.find((o) => o.id === orderId);
    if (!current) throw new Error("Order not found.");
    guardOutlet(auth, current.outletId);
    const now = Date.now();
    const lines = current.lines.map((l) =>
      l.lineId === lineId && l.lineStatus !== "collected"
        ? { ...l, lineStatus: "ready" as const, readyAt: now }
        : l,
    );
    let next: Order = {
      ...current,
      lines,
      history: current.status === "Placed" || current.status === "Accepted"
        ? [...current.history, { status: "Preparing", at: now }]
        : current.history,
    };
    next = syncOrderStatus(next);
    await saveOrder(next);
    await stamp(auth?.staffName ?? "Staff", "order.line", `#${next.number} line ready`);
    return next;
  });
}

function collectReadyLines(order: Order): Order {
  const now = Date.now();
  const lines = order.lines.map((l) =>
    l.lineStatus === "ready" ? { ...l, lineStatus: "collected" as const, collectedAt: now } : l,
  );
  return syncOrderStatus({
    ...order,
    lines,
    history: [...order.history, { status: lines.every((l) => l.lineStatus === "collected") ? "Collected" : order.status, at: now }],
  });
}

async function finishIfCollected(order: Order, auth: AuthSession | null) {
  if (order.status === "Collected") {
    const now = Date.now();
    const rs = await exec(
      "SELECT phone, points, lifetime_points, visits, streak, last_visit, history FROM customers WHERE phone = ?",
      [order.phone],
    );
    const row = rs.rows[0];
    if (row) {
      const last = maybeN(row, "last_visit") ?? 0;
      const streak = last && now - last < 8 * 864e5 ? n(row, "streak") + 1 : 1;
      const history = [
        { at: now, delta: order.pointsEarned, label: `Order #${order.number}` },
        ...parseJson(s(row, "history"), [] as Customer["history"]),
      ];
      await exec(
        "UPDATE customers SET points = ?, lifetime_points = ?, visits = ?, streak = ?, last_visit = ?, history = ? WHERE phone = ?",
        [
          n(row, "points") + order.pointsEarned,
          n(row, "lifetime_points") + order.pointsEarned,
          n(row, "visits") + 1,
          streak,
          now,
          JSON.stringify(history),
          order.phone,
        ],
      );
    }
  }
  await saveOrder(order);
  await stamp(auth?.staffName ?? "Staff", "order.collect", `#${order.number}`);
}

export async function collectPickup(auth: AuthSession | null, raw: string, outletId: string) {
  requireStaff(auth);
  guardOutlet(auth, outletId);
  const orders = await loadOrders();
  const verdict = evaluateScan(orders, raw, outletId);
  const order = verdict.order ? orders.find((o) => o.id === verdict.order!.id) : undefined;
  if (!verdict.ok) {
    return order
      ? { ok: false as const, reason: verdict.reason, order }
      : { ok: false as const, reason: verdict.reason };
  }
  if (!order) return { ok: false as const, reason: "No order found" };
  return { ok: true as const, order };
}

export async function confirmPickup(auth: AuthSession | null, orderId: string) {
  requireStaff(auth);
  return serialize(async () => {
    const orders = await loadOrders();
    const current = orders.find((o) => o.id === orderId);
    if (!current) throw new Error("Order not found.");
    guardOutlet(auth, current.outletId);
    const next = collectReadyLines(current);
    await finishIfCollected(next, auth);
    return next;
  });
}

export async function updateOutlet(auth: AuthSession | null, id: string, patch: Partial<Outlet>) {
  requireStaff(auth);
  const rs = await exec("SELECT data FROM outlets WHERE id = ?", [id]);
  const current = parseJson<Outlet>(rs.rows[0] ? s(rs.rows[0], "data") : null, null as unknown as Outlet);
  if (!current) throw new Error("Outlet not found.");
  const merged: Outlet = { ...current, ...patch, id };
  const slot = Math.max(
    1,
    Math.min(
      120,
      Math.round(
        patch.minutesPerOrder ??
          patch.waitMinutes ??
          current.minutesPerOrder ??
          current.fallbackWaitMinutes ??
          current.waitMinutes ??
          10,
      ),
    ),
  );
  const stored: Outlet = {
    id: merged.id,
    name: merged.name,
    short: merged.short,
    address: merged.address,
    hours: merged.hours,
    openHour: merged.openHour,
    closeHour: merged.closeHour,
    mapUrl: merged.mapUrl,
    phone: merged.phone,
    waitMinutes: slot,
    minutesPerOrder: slot,
    fallbackWaitMinutes: slot,
    isOpen: merged.isOpen,
    pauseOrders: merged.pauseOrders,
    ...(merged.forceOpen ? { forceOpen: true } : {}),
  };
  await exec("INSERT OR REPLACE INTO outlets (id, data) VALUES (?, ?)", [id, JSON.stringify(stored)]);
  await stamp(auth?.staffName ?? "Staff", "outlet.update", `${id}: ${Object.keys(patch).join(", ")}`);
}

export async function upsertMenuItem(auth: AuthSession | null, item: MenuItem) {
  requireStaff(auth);
  const next: MenuItem = {
    ...item,
    veg: true,
    prepMinutes: Math.max(1, Math.round(item.prepMinutes || 8)),
  };
  await exec("INSERT OR REPLACE INTO menu_items (id, data) VALUES (?, ?)", [next.id, JSON.stringify(next)]);
  await stamp(auth?.staffName ?? "Staff", "menu.save", next.name);
}

export async function deleteMenuItem(auth: AuthSession | null, id: string) {
  requireOwner(auth);
  await exec("DELETE FROM menu_items WHERE id = ?", [id]);
  await stamp(auth?.staffName ?? "Owner", "menu.delete", id);
}

export async function updateLoyalty(auth: AuthSession | null, rule: LoyaltyRule) {
  requireOwner(auth);
  await exec("INSERT OR REPLACE INTO loyalty (id, data) VALUES ('shop', ?)", [JSON.stringify(rule)]);
  await stamp(auth?.staffName ?? "Owner", "loyalty.update", `${rule.pointsPerHundred} pts / Rs 100`);
}

export async function saveCoupon(auth: AuthSession | null, coupon: Coupon) {
  requireOwner(auth);
  await exec("INSERT OR REPLACE INTO coupons (id, data) VALUES (?, ?)", [coupon.id, JSON.stringify(coupon)]);
  await stamp(auth?.staffName ?? "Owner", "coupon.save", coupon.code);
}

export async function deleteCoupon(auth: AuthSession | null, id: string) {
  requireOwner(auth);
  await exec("DELETE FROM coupons WHERE id = ?", [id]);
  await stamp(auth?.staffName ?? "Owner", "coupon.delete", id);
}

export async function updateSettings(auth: AuthSession | null, settings: ShopSettings) {
  requireOwner(auth);
  await exec("INSERT OR REPLACE INTO settings (id, data) VALUES ('shop', ?)", [JSON.stringify(settings)]);
  await stamp(auth?.staffName ?? "Owner", "settings.update", `tax ${settings.taxPercent}%`);
}

export async function adjustPoints(auth: AuthSession | null, phone: string, delta: number, reason: string) {
  requireOwner(auth);
  if (!reason.trim()) throw new Error("Add a reason.");
  const rs = await exec("SELECT points, lifetime_points, history FROM customers WHERE phone = ?", [phone]);
  const row = rs.rows[0];
  if (!row) throw new Error("Customer not found.");
  const now = Date.now();
  const points = Math.max(0, n(row, "points") + delta);
  const lifetime = delta > 0 ? n(row, "lifetime_points") + delta : n(row, "lifetime_points");
  const history = [{ at: now, delta, label: reason.trim() }, ...parseJson(s(row, "history"), [] as Customer["history"])];
  await exec("UPDATE customers SET points = ?, lifetime_points = ?, history = ? WHERE phone = ?", [
    points,
    lifetime,
    JSON.stringify(history),
    phone,
  ]);
  await stamp(auth?.staffName ?? "Owner", "customer.points", `${phone} ${delta}: ${reason.trim()}`);
}

export async function saveMessage(input: {
  name: string;
  phone: string;
  message: string;
  outletId: string | null;
}) {
  if (!input.name.trim() || input.phone.trim().length < 10 || input.message.trim().length < 8) {
    throw new Error("Name, a 10-digit phone and a short message are required.");
  }
  const message: ContactMessage = {
    id: `msg_${uid()}`,
    name: input.name.trim(),
    phone: input.phone.trim(),
    message: input.message.trim(),
    outletId: input.outletId,
    at: Date.now(),
  };
  await exec("INSERT INTO messages (id, data) VALUES (?, ?)", [message.id, JSON.stringify(message)]);
  return message;
}

export async function loadProduct(slug: string) {
  await ensureSeed();
  if (!slug || slug.length > 80) throw new Error("That link doesn't look right.");
  const menu = await loadMenu();
  return findBySlug(menu, slug) ?? null;
}

export async function getAnalytics(
  auth: AuthSession | null,
  outletId: string | "all",
  period: Period,
  range?: { from?: number; to?: number },
) {
  requireOwner(auth);
  const [orders, menu, outlets] = await Promise.all([loadOrders(), loadMenu(), loadOutlets()]);
  if (outletId !== "all" && !outlets.some((o) => o.id === outletId)) throw new Error("Unknown outlet.");
  return buildAnalytics({ orders, menu, outlets, outletId, period, from: range?.from, to: range?.to });
}

export async function updateProfile(auth: AuthSession | null, input: { name: string; email: string }) {
  if (auth?.kind !== "customer" || !auth.phone) throw new Error("Sign in first.");
  if (!input.name.trim()) throw new Error("Name is required.");
  await exec("UPDATE customers SET name = ?, email = ? WHERE phone = ?", [
    input.name.trim(),
    input.email.trim() || null,
    auth.phone,
  ]);
  return { name: input.name.trim(), email: input.email.trim() };
}

export async function addWorker(
  auth: AuthSession | null,
  input: { outletId: string; name: string; phone?: string; role: KitchenWorker["role"] },
) {
  requireStaff(auth);
  guardOutlet(auth, input.outletId);
  const name = input.name.trim();
  if (!name) throw new Error("Worker name is required.");
  const worker: KitchenWorker = {
    id: `w_${uid()}`,
    outletId: input.outletId,
    name,
    phone: input.phone?.trim() || undefined,
    role: input.role,
    active: true,
  };
  await exec("INSERT INTO workers (id, outlet_id, name, phone, role, active) VALUES (?, ?, ?, ?, ?, 1)", [
    worker.id,
    worker.outletId,
    worker.name,
    worker.phone ?? null,
    worker.role,
  ]);
  await stamp(auth?.staffName ?? "Staff", "worker.add", worker.name);
  return worker;
}

export async function setWorkerActive(auth: AuthSession | null, id: string, active: boolean) {
  requireStaff(auth);
  const rs = await exec("SELECT outlet_id FROM workers WHERE id = ?", [id]);
  if (!rs.rows[0]) throw new Error("Worker not found.");
  guardOutlet(auth, s(rs.rows[0], "outlet_id"));
  await exec("UPDATE workers SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
}

export async function clockWorker(auth: AuthSession | null, workerId: string, action: "in" | "out") {
  requireStaff(auth);
  const rs = await exec("SELECT id, outlet_id, name, active FROM workers WHERE id = ?", [workerId]);
  const row = rs.rows[0];
  if (!row) throw new Error("Worker not found.");
  guardOutlet(auth, s(row, "outlet_id"));
  if (n(row, "active") !== 1) throw new Error("This worker is archived.");
  const now = Date.now();
  if (action === "in") {
    const open = await exec(
      "SELECT id FROM attendance WHERE worker_id = ? AND clock_out IS NULL LIMIT 1",
      [workerId],
    );
    if (open.rows.length) throw new Error("Already clocked in.");
    const rec: AttendanceRecord = {
      id: `att_${uid()}`,
      workerId,
      outletId: s(row, "outlet_id"),
      workerName: s(row, "name"),
      clockIn: now,
    };
    await exec(
      "INSERT INTO attendance (id, worker_id, outlet_id, worker_name, clock_in, clock_out) VALUES (?, ?, ?, ?, ?, NULL)",
      [rec.id, rec.workerId, rec.outletId, rec.workerName, rec.clockIn],
    );
    await stamp(auth?.staffName ?? "Staff", "attendance.in", rec.workerName);
    return rec;
  }
  const open = await exec(
    "SELECT id FROM attendance WHERE worker_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1",
    [workerId],
  );
  const id = open.rows[0] ? s(open.rows[0], "id") : "";
  if (!id) throw new Error("Not clocked in.");
  await exec("UPDATE attendance SET clock_out = ? WHERE id = ?", [now, id]);
  await stamp(auth?.staffName ?? "Staff", "attendance.out", s(row, "name"));
  return { id: String(id), clockOut: now };
}

export async function setItemPrep(auth: AuthSession | null, itemId: string, prepMinutes: number) {
  requireStaff(auth);
  const minutes = Math.max(1, Math.min(120, Math.round(prepMinutes)));
  const rs = await exec("SELECT data FROM menu_items WHERE id = ?", [itemId]);
  const item = parseJson<MenuItem>(rs.rows[0] ? s(rs.rows[0], "data") : null, null as unknown as MenuItem);
  if (!item) throw new Error("Item not found.");
  item.prepMinutes = minutes;
  await exec("INSERT OR REPLACE INTO menu_items (id, data) VALUES (?, ?)", [item.id, JSON.stringify(item)]);
  await stamp(auth?.staffName ?? "Staff", "menu.prep", `${item.name} ${minutes}m`);
  return item;
}

export function unitPriceFor(item: MenuItem, outletId: string, size?: CartLine["size"], toppings: string[] = []) {
  return unitPrice(item, outletId, size, toppings);
}

function requireStaff(auth: AuthSession | null): asserts auth is AuthSession & { kind: "staff" } {
  if (auth?.kind !== "staff") throw new Error("Staff sign-in required.");
}

function requireOwner(auth: AuthSession | null) {
  requireStaff(auth);
  if (auth.role !== "owner") throw new Error("Owner access only.");
}

function guardOutlet(auth: AuthSession | null, outletId: string) {
  if (auth?.kind !== "staff") throw new Error("Staff sign-in required.");
  if (auth.role === "kitchen" && auth.outletId && auth.outletId !== outletId) {
    throw new Error("Wrong outlet.");
  }
}

export type { LineStatus };
