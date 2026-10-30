/**
 * Async service layer. Every UI mutation goes through here so a real backend
 * can replace the localStorage implementation without touching components.
 * // INTEGRATION: swap this module for HTTP calls. Do not read localStorage in components.
 */
import { getDB, getSession, setDB, setSession } from "./store";
import { billOptions, cartSubtotal, computeBill, unitPrice, validateCoupon } from "./pricing";
import { buildAnalytics, type Period } from "./analytics";
import { canTransition } from "./orders";
import { evaluateScan } from "./scan";
import { findBySlug } from "./slug";
import type {
  AuditEntry,
  CartLine,
  Coupon,
  LoyaltyRule,
  MenuItem,
  Order,
  OrderStatus,
  Outlet,
  PaymentMethod,
  ShopSettings,
} from "./types";

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);

function stamp(d: ReturnType<typeof getDB>, action: string, detail: string) {
  const actor = getSession().staff?.name ?? "System";
  const entry: AuditEntry = { id: `aud_${uid()}`, at: Date.now(), actor, action, detail };
  return { ...d, audit: [entry, ...d.audit].slice(0, 400) };
}

function appliedCoupon(code: string | null, subtotal: number) {
  if (!code) return null;
  const coupon = getDB().coupons.find((c) => c.code.toLowerCase() === code.toLowerCase());
  if (!coupon) return null;
  return validateCoupon(coupon, subtotal, Date.now()).ok ? coupon : null;
}

export async function selectOutlet(outletId: string) {
  setSession((s) => ({ ...s, outletId }));
}
export function addToCart(line: Omit<CartLine, "key">) {
  setSession((s) => {
    const key = `${line.itemId}|${line.size ?? ""}|${[...line.toppings].sort().join(",")}|${line.note ?? ""}`;
    const existing = s.cart.find((l) => l.key === key);
    const cart = existing
      ? s.cart.map((l) => (l.key === key ? { ...l, qty: l.qty + line.qty } : l))
      : [...s.cart, { ...line, key }];
    return { ...s, cart };
  });
}
export function setQty(key: string, qty: number) {
  setSession((s) => ({
    ...s,
    cart:
      qty <= 0
        ? s.cart.filter((l) => l.key !== key)
        : s.cart.map((l) => (l.key === key ? { ...l, qty } : l)),
  }));
}
export function setRedeem(stepId: string | null) {
  setSession((s) => ({ ...s, redeemStepId: stepId }));
}
export function clearCoupon() {
  setSession((s) => ({ ...s, couponCode: null }));
}
export async function applyCoupon(code: string) {
  await delay(120);
  const subtotal = cartSubtotal(getSession().cart);
  const coupon = getDB().coupons.find((c) => c.code.toLowerCase() === code.trim().toLowerCase());
  if (!coupon) throw new Error("No coupon with that code.");
  const check = validateCoupon(coupon, subtotal, Date.now());
  if (!check.ok) throw new Error(check.reason);
  setSession((s) => ({ ...s, couponCode: coupon.code }));
  return coupon;
}

export async function sendOtp(phone: string) {
  await delay(500);
  // INTEGRATION: send a real SMS OTP
  return { sent: true, hint: "Demo OTP is 1234", phone };
}
export async function verifyOtp(phone: string, otp: string, name: string) {
  await delay(400);
  if (otp !== "1234") throw new Error("That code doesn't match. Try 1234 (demo).");
  setDB((d) =>
    d.customers.some((c) => c.phone === phone)
      ? {
          ...d,
          customers: d.customers.map((c) => (c.phone === phone && name ? { ...c, name } : c)),
        }
      : {
          ...d,
          customers: [
            ...d.customers,
            {
              phone,
              name: name || "Guest",
              points: 0,
              lifetimePoints: 0,
              visits: 0,
              streak: 0,
              history: [],
            },
          ],
        },
  );
  setSession((s) => ({ ...s, phone }));
}
export function signOutCustomer() {
  setSession((s) => ({ ...s, phone: null }));
}
export async function updateProfile(input: { name: string; email: string }) {
  await delay(200);
  const phone = getSession().phone;
  if (!phone) throw new Error("Sign in first.");
  if (!input.name.trim()) throw new Error("Name is required.");
  setDB((d) => ({
    ...d,
    customers: d.customers.map((c) =>
      c.phone === phone
        ? { ...c, name: input.name.trim(), email: input.email.trim() || undefined }
        : c,
    ),
  }));
}

export async function placeOrder(input: {
  payment: PaymentMethod;
  name: string;
  notes?: string | undefined;
  scheduledFor?: number | undefined;
}) {
  await delay(600);
  const s = getSession();
  const d = getDB();
  if (!s.outletId || !s.phone || !s.cart.length) throw new Error("Missing outlet, phone or cart");
  const outlet = d.outlets.find((o) => o.id === s.outletId)!;
  if (!outlet.isOpen || outlet.pauseOrders)
    throw new Error("This outlet isn't taking orders right now.");
  const subtotal = cartSubtotal(s.cart);
  if (subtotal < d.settings.minimumOrder) {
    throw new Error(`Minimum order is Rs ${d.settings.minimumOrder.toLocaleString("en-IN")}.`);
  }
  const customer = d.customers.find((c) => c.phone === s.phone);
  let step = d.loyalty.steps.find((x) => x.id === s.redeemStepId) ?? null;
  if (step && (customer?.points ?? 0) < step.points) step = null;
  const coupon = appliedCoupon(s.couponCode, subtotal);
  if (s.couponCode && !coupon) throw new Error("That coupon can no longer be applied.");
  const bill = computeBill(s.cart, d.loyalty, step, billOptions(d.settings, coupon));
  const now = Date.now();
  const number = d.nextNumber;
  const prep = outlet.waitMinutes || d.settings.defaultPrepMinutes;
  const order: Order = {
    id: `ord_${number}_${uid()}`,
    number,
    outletId: outlet.id,
    customerName: input.name,
    phone: s.phone,
    lines: s.cart,
    ...bill,
    couponCode: coupon?.code,
    payment: input.payment,
    paid: input.payment === "online",
    qrToken: input.payment === "online" ? uid() + uid() : undefined,
    status: "Placed",
    history: [{ status: "Placed", at: now }],
    createdAt: now,
    promisedAt: input.scheduledFor ?? now + prep * 6e4,
    scheduledFor: input.scheduledFor,
    notes: input.notes,
  };
  setDB((db) => {
    const next = {
      ...db,
      nextNumber: number + 1,
      orders: [order, ...db.orders],
      coupons: db.coupons.map((c) =>
        coupon && c.id === coupon.id ? { ...c, used: c.used + 1 } : c,
      ),
      customers: db.customers.map((c) =>
        c.phone === s.phone && step
          ? {
              ...c,
              points: c.points - step.points,
              history: [
                { at: now, delta: -step.points, label: `Redeemed ${step.label}` },
                ...c.history,
              ],
            }
          : c,
      ),
    };
    return stamp(next, "order.place", `#${order.number} placed (${input.payment})`);
  });
  setSession((ss) => ({
    ...ss,
    cart: [],
    redeemStepId: null,
    couponCode: null,
    myOrders: [order.id, ...ss.myOrders],
  }));
  return order;
}

export async function reorder(orderId: string) {
  await delay(200);
  const d = getDB();
  const s = getSession();
  const order = d.orders.find((o) => o.id === orderId);
  if (!order) throw new Error("Order not found.");
  const outletId = s.outletId ?? order.outletId;
  if (!s.outletId) setSession((ss) => ({ ...ss, outletId }));
  const skipped: string[] = [];
  let added = 0;
  for (const line of order.lines) {
    const item = d.menu.find((m) => m.id === line.itemId);
    if (!item || item.availability[outletId] === false) {
      skipped.push(line.name);
      continue;
    }
    const toppings = line.toppings.filter(
      (name) => !item.toppings || item.toppings.some((t) => t.name === name),
    );
    addToCart({
      itemId: item.id,
      name: item.name,
      image: item.image,
      veg: item.veg,
      size: line.size,
      toppings,
      note: line.note,
      unitPrice: unitPrice(item, outletId, line.size, toppings),
      qty: line.qty,
    });
    added += 1;
  }
  return { added, skipped };
}

export async function setOrderStatus(id: string, status: OrderStatus, reason?: string) {
  const now = Date.now();
  const current = getDB().orders.find((o) => o.id === id);
  if (!current) throw new Error("Order not found.");
  if (!canTransition(current.status, status))
    throw new Error(`Can't move an order from ${current.status} to ${status}.`);
  if (status === "Rejected" && !reason?.trim()) throw new Error("A reject reason is required.");
  setDB((d) => {
    const order = d.orders.find((o) => o.id === id);
    if (!order) return d;
    let customers = d.customers;
    if (status === "Collected" && order.status !== "Collected") {
      customers = customers.map((c) =>
        c.phone === order.phone
          ? {
              ...c,
              points: c.points + order.pointsEarned,
              lifetimePoints: c.lifetimePoints + order.pointsEarned,
              visits: c.visits + 1,
              streak: c.lastVisit && now - c.lastVisit < 8 * 864e5 ? c.streak + 1 : 1,
              lastVisit: now,
              history: [
                { at: now, delta: order.pointsEarned, label: `Order #${order.number}` },
                ...c.history,
              ],
            }
          : c,
      );
    }
    const next = {
      ...d,
      customers,
      orders: d.orders.map((o) =>
        o.id === id
          ? {
              ...o,
              status,
              rejectReason: reason ?? o.rejectReason,
              paid: status === "Collected" ? true : o.paid,
              qrUsed: status === "Collected" ? true : o.qrUsed,
              history: [...o.history, { status, at: now }],
            }
          : o,
      ),
    };
    return stamp(
      next,
      "order.status",
      `#${order.number} → ${status}${reason ? ` (${reason})` : ""}`,
    );
  });
}

export type ScanResult = { ok: true; order: Order } | { ok: false; reason: string; order?: Order };
export async function verifyScan(raw: string, outletId: string): Promise<ScanResult> {
  await delay(200);
  const d = getDB();
  const verdict = evaluateScan(d.orders, raw, outletId);
  const order = verdict.order ? d.orders.find((o) => o.id === verdict.order!.id) : undefined;
  if (!verdict.ok)
    return order
      ? { ok: false, reason: verdict.reason, order }
      : { ok: false, reason: verdict.reason };
  if (!order) return { ok: false, reason: "No order found" };
  return { ok: true, order };
}

const DEMO_NAMES = ["Priya", "Kunal", "Neha", "Farhan", "Tara", "Yash"];
export async function simulateOrder(outletId: string) {
  const d = getDB();
  const pick = d.menu
    .filter((m) => m.availability[outletId])
    .sort(() => Math.random() - 0.5)
    .slice(0, 1 + Math.floor(Math.random() * 3));
  const lines: CartLine[] = pick.map((m) => ({
    key: m.id,
    itemId: m.id,
    name: m.name,
    image: m.image,
    veg: m.veg,
    size: m.sizes ? "Medium" : undefined,
    toppings: m.toppings && Math.random() > 0.5 ? [m.toppings[0]!.name] : [],
    unitPrice: m.price + (m.sizes ? 120 : 0),
    qty: 1,
  }));
  const bill = computeBill(lines, d.loyalty, null, billOptions(d.settings, null));
  const now = Date.now();
  const online = Math.random() > 0.5;
  const outlet = d.outlets.find((o) => o.id === outletId)!;
  const order: Order = {
    id: `ord_${d.nextNumber}_${uid()}`,
    number: d.nextNumber,
    outletId,
    customerName: DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)]!,
    phone: "9000000000",
    lines,
    ...bill,
    payment: online ? "online" : "counter",
    paid: online,
    qrToken: online ? uid() : undefined,
    status: "Placed",
    history: [{ status: "Placed", at: now }],
    createdAt: now,
    promisedAt: now + (outlet.waitMinutes || d.settings.defaultPrepMinutes) * 6e4,
    notes: Math.random() > 0.6 ? "Extra crispy please" : undefined,
  };
  setDB((db) =>
    stamp(
      { ...db, nextNumber: db.nextNumber + 1, orders: [order, ...db.orders] },
      "order.simulate",
      `#${order.number}`,
    ),
  );
  return order;
}

export async function updateOutlet(id: string, patch: Partial<Outlet>) {
  setDB((d) =>
    stamp(
      { ...d, outlets: d.outlets.map((o) => (o.id === id ? { ...o, ...patch } : o)) },
      "outlet.update",
      `${id}: ${Object.keys(patch).join(", ")}`,
    ),
  );
}
export async function upsertMenuItem(item: MenuItem) {
  setDB((d) =>
    stamp(
      {
        ...d,
        menu: d.menu.some((m) => m.id === item.id)
          ? d.menu.map((m) => (m.id === item.id ? item : m))
          : [...d.menu, item],
      },
      "menu.save",
      item.name,
    ),
  );
}
export async function deleteMenuItem(id: string) {
  const name = getDB().menu.find((m) => m.id === id)?.name ?? id;
  setDB((d) => stamp({ ...d, menu: d.menu.filter((m) => m.id !== id) }, "menu.delete", name));
}
export async function updateLoyalty(rule: LoyaltyRule) {
  setDB((d) =>
    stamp({ ...d, loyalty: rule }, "loyalty.update", `${rule.pointsPerHundred} pts / Rs 100`),
  );
}
export async function saveCoupon(coupon: Coupon) {
  setDB((d) =>
    stamp(
      {
        ...d,
        coupons: d.coupons.some((c) => c.id === coupon.id)
          ? d.coupons.map((c) => (c.id === coupon.id ? coupon : c))
          : [...d.coupons, coupon],
      },
      "coupon.save",
      coupon.code,
    ),
  );
}
export async function deleteCoupon(id: string) {
  const code = getDB().coupons.find((c) => c.id === id)?.code ?? id;
  setDB((d) =>
    stamp({ ...d, coupons: d.coupons.filter((c) => c.id !== id) }, "coupon.delete", code),
  );
}
export async function updateSettings(settings: ShopSettings) {
  setDB((d) =>
    stamp(
      { ...d, settings },
      "settings.update",
      `tax ${settings.taxPercent}% · packaging Rs ${settings.packagingFee}`,
    ),
  );
}
export async function adjustPoints(phone: string, delta: number, reason: string) {
  await delay(150);
  if (!reason.trim()) throw new Error("Add a reason.");
  const customer = getDB().customers.find((c) => c.phone === phone);
  if (!customer) throw new Error("Customer not found.");
  const now = Date.now();
  setDB((d) =>
    stamp(
      {
        ...d,
        customers: d.customers.map((c) =>
          c.phone === phone
            ? {
                ...c,
                points: Math.max(0, c.points + delta),
                lifetimePoints: delta > 0 ? c.lifetimePoints + delta : c.lifetimePoints,
                history: [{ at: now, delta, label: reason.trim() }, ...c.history],
              }
            : c,
        ),
      },
      "customer.points",
      `${phone} ${delta > 0 ? "+" : ""}${delta}: ${reason.trim()}`,
    ),
  );
}
export async function saveMessage(input: {
  name: string;
  phone: string;
  message: string;
  outletId: string | null;
}) {
  await delay(300);
  if (!input.name.trim() || input.phone.trim().length < 10 || input.message.trim().length < 8) {
    throw new Error("Name, a 10-digit phone and a short message are required.");
  }
  const message = {
    id: `msg_${uid()}`,
    name: input.name.trim(),
    phone: input.phone.trim(),
    message: input.message.trim(),
    outletId: input.outletId,
    at: Date.now(),
  };
  setDB((d) =>
    stamp(
      { ...d, messages: [message, ...d.messages] },
      "contact.message",
      `${message.name} · ${message.phone}`,
    ),
  );
  return message;
}

export async function loadProduct(slug: string) {
  await delay(180);
  if (!slug || slug.length > 80) throw new Error("That link doesn't look right.");
  return findBySlug(getDB().menu, slug) ?? null;
}

export async function getAnalytics(
  outletId: string | "all",
  period: Period,
  range?: { from?: number; to?: number },
) {
  await delay(180);
  const d = getDB();
  if (outletId !== "all" && !d.outlets.some((o) => o.id === outletId))
    throw new Error("Unknown outlet.");
  return buildAnalytics({
    orders: d.orders,
    menu: d.menu,
    outlets: d.outlets,
    outletId,
    period,
    from: range?.from,
    to: range?.to,
  });
}

export async function ready() {
  await delay(160);
  if (!getDB().menu) throw new Error("Store unavailable");
  return true;
}

export async function staffLogin(username: string, password: string) {
  await delay(400);
  const staff = getDB().staff.find((s) => s.username === username.trim().toLowerCase());
  if (!staff || password !== "grizzly") throw new Error("Wrong username or password");
  setSession((s) => ({ ...s, staff }));
  return staff;
}
export function staffLogout() {
  setSession((s) => ({ ...s, staff: null }));
}
