/**
 * UI talks only to this module. Mutations hit encrypted-session server functions
 * backed by SQLite. Cart and outlet stay on the device until checkout.
 */
import { uid } from "@/lib/id";
import {
  addWorkerFn,
  adjustPointsFn,
  clockWorkerFn,
  confirmPickupFn,
  customerLogoutFn,
  customerPasswordLoginFn,
  requestCustomerOtpFn,
  requestPhoneLoginOtpFn,
  sendMarketingCampaignFn,
  setMarketingConsentFn,
  verifyCustomerOtpFn,
  deleteCouponFn,
  deleteMenuItemFn,
  getAnalyticsFn,
  getShopFn,
  loadProductFn,
  markCounterCollectedFn,
  paymentStatusFn,
  placeOrderFn,
  resumeRazorpayCheckoutFn,
  startRazorpayCheckoutFn,
  verifyRazorpayPaymentFn,
  readyFn,
  saveCouponFn,
  saveMessageFn,
  setItemPrepFn,
  setLineReadyFn,
  setOrderStatusFn,
  setWorkerActiveFn,
  staffLoginFn,
  staffLogoutFn,
  updateLoyaltyFn,
  updateOutletFn,
  updateProfileFn,
  updateSettingsFn,
  upsertMenuItemFn,
  verifyScanFn,
} from "@/services/rpc";
import { cartSubtotal, unitPrice, validateCoupon } from "./pricing";
import { getDB, getSession, refreshShop, setSession } from "./store";
import type {
  CartLine,
  Coupon,
  KitchenWorker,
  LoyaltyRule,
  MenuItem,
  Order,
  OrderStatus,
  Outlet,
  PaymentMethod,
  ShopSettings,
} from "./types";
import type { Period } from "./analytics";

function bump() {
  return refreshShop();
}

export async function selectOutlet(outletId: string) {
  setSession((s) => ({ ...s, outletId }));
}

export function addToCart(
  line: Omit<CartLine, "key" | "lineId" | "lineStatus" | "prepMinutes"> &
    Partial<Pick<CartLine, "lineId" | "lineStatus" | "prepMinutes">>,
) {
  setSession((s) => {
    const item = getDB().menu.find((m) => m.id === line.itemId);
    const prepMinutes = line.prepMinutes || item?.prepMinutes || getDB().settings.defaultPrepMinutes;
    const key = `${line.itemId}|${line.size ?? ""}|${[...line.toppings].sort().join(",")}|${line.note ?? ""}`;
    const existing = s.cart.find((l) => l.key === key);
    const cart = existing
      ? s.cart.map((l) => (l.key === key ? { ...l, qty: l.qty + line.qty } : l))
      : [
          ...s.cart,
          {
            ...line,
            key,
            lineId: line.lineId || `ln_${uid()}`,
            prepMinutes,
            lineStatus: line.lineStatus ?? "queued",
          },
        ];
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
  const subtotal = cartSubtotal(getSession().cart);
  const coupon = getDB().coupons.find((c) => c.code.toLowerCase() === code.trim().toLowerCase());
  if (!coupon) throw new Error("No coupon with that code.");
  const check = validateCoupon(coupon, subtotal, Date.now());
  if (!check.ok) throw new Error(check.reason);
  setSession((s) => ({ ...s, couponCode: coupon.code }));
  return coupon;
}

export async function customerPasswordLogin(username: string, password: string) {
  const user = await customerPasswordLoginFn({ data: { username, password } });
  setSession((s) => ({ ...s, phone: user.phone, customerName: user.name }));
  await bump();
  return user;
}

export async function requestCustomerOtp(input: {
  username: string;
  phone?: string | undefined;
  password?: string | undefined;
  intent: "register" | "reset";
}) {
  return requestCustomerOtpFn({ data: input });
}

export async function requestPhoneLoginOtp(phone: string) {
  return requestPhoneLoginOtpFn({ data: { phone } });
}

export async function verifyCustomerOtp(phone: string, code: string, newPassword?: string | undefined) {
  const user = await verifyCustomerOtpFn({
    data: { phone, code, ...(newPassword ? { newPassword } : {}) },
  });
  setSession((s) => ({ ...s, phone: user.phone, customerName: user.name }));
  await bump();
  return user;
}

export async function setWhatsAppMarketingConsent(consented: boolean, source = "account") {
  const result = await setMarketingConsentFn({ data: { consented, source } });
  await bump();
  return result;
}

export async function sendWhatsAppMarketingCampaign(input: {
  phone: string;
  campaignKey: string;
  bodyValues?: string[];
}) {
  return sendMarketingCampaignFn({ data: input });
}

export function signOutCustomer() {
  void customerLogoutFn();
  setSession((s) => ({ ...s, phone: null, customerName: null }));
}

export async function updateProfile(input: { name: string; email: string }) {
  const next = await updateProfileFn({ data: input });
  setSession((s) => ({ ...s, customerName: next.name }));
  await bump();
}

function checkoutPayload(input: { name: string; notes?: string | undefined; scheduledFor?: number | undefined }) {
  const s = getSession();
  return {
    name: input.name,
    notes: input.notes,
    scheduledFor: input.scheduledFor,
    cart: s.cart,
    outletId: s.outletId,
    redeemStepId: s.redeemStepId,
    couponCode: s.couponCode,
    checkoutKey: checkoutKeyFor(s, input),
  };
}

function checkoutKeyFor(
  s: ReturnType<typeof getSession>,
  input: { name: string; notes?: string | undefined },
) {
  const raw = JSON.stringify({
    outletId: s.outletId,
    coupon: s.couponCode,
    redeem: s.redeemStepId,
    name: input.name.trim(),
    notes: input.notes?.trim() ?? "",
    lines: s.cart.map((line) => ({
      id: line.itemId,
      size: line.size ?? "",
      toppings: [...line.toppings].sort(),
      qty: line.qty,
      note: line.note ?? "",
    })),
  });
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `chk_${(hash >>> 0).toString(36).padStart(7, "0")}_${raw.length.toString(36)}`;
}

function rememberOrder(orderId: string) {
  setSession((ss) => ({
    ...ss,
    myOrders: ss.myOrders.includes(orderId) ? ss.myOrders : [orderId, ...ss.myOrders],
  }));
}

function finishPaidCheckout(orderId: string) {
  setSession((ss) => ({
    ...ss,
    cart: [],
    redeemStepId: null,
    couponCode: null,
    myOrders: [orderId, ...ss.myOrders.filter((id) => id !== orderId)],
  }));
}

export async function startRazorpayCheckout(input: {
  name: string;
  notes?: string | undefined;
  scheduledFor?: number | undefined;
}) {
  const { notes, scheduledFor, ...rest } = checkoutPayload(input);
  const session = await startRazorpayCheckoutFn({
    data: {
      ...rest,
      ...(notes ? { notes } : {}),
      ...(scheduledFor ? { scheduledFor } : {}),
    },
  });
  rememberOrder(session.orderId);
  if (session.alreadyPaid) finishPaidCheckout(session.orderId);
  await bump();
  return session;
}

export async function resumeRazorpayCheckout(orderId: string) {
  const session = await resumeRazorpayCheckoutFn({ data: { orderId } });
  if (session.alreadyPaid) finishPaidCheckout(session.orderId);
  await bump();
  return session;
}

export async function verifyRazorpayPayment(input: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const order = await verifyRazorpayPaymentFn({ data: input });
  if (order.paid) finishPaidCheckout(order.id);
  await bump();
  return order;
}

export async function fetchPaymentStatus(orderId: string) {
  const status = await paymentStatusFn({ data: { orderId } });
  if (status.paid && status.payment === "online") finishPaidCheckout(status.orderId);
  await bump();
  return status;
}

export async function markCounterCollected(orderId: string) {
  const order = await markCounterCollectedFn({ data: { orderId } });
  await bump();
  return order;
}

export async function placeOrder(input: {
  payment: PaymentMethod;
  name: string;
  notes?: string | undefined;
  scheduledFor?: number | undefined;
}) {
  const s = getSession();
  const order = await placeOrderFn({
    data: {
      payment: input.payment,
      name: input.name,
      notes: input.notes,
      scheduledFor: input.scheduledFor,
      cart: s.cart,
      outletId: s.outletId,
      redeemStepId: s.redeemStepId,
      couponCode: s.couponCode,
    },
  });
  setSession((ss) => ({
    ...ss,
    cart: [],
    redeemStepId: null,
    couponCode: null,
    myOrders: [order.id, ...ss.myOrders],
  }));
  await bump();
  return order;
}

export async function reorder(orderId: string) {
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
      prepMinutes: item.prepMinutes,
    });
    added += 1;
  }
  return { added, skipped };
}

export async function setOrderStatus(id: string, status: OrderStatus, reason?: string) {
  await setOrderStatusFn({ data: { id, status, reason } });
  await bump();
}

export async function setLineReady(orderId: string, lineId: string) {
  await setLineReadyFn({ data: { orderId, lineId } });
  await bump();
}

export type ScanResult = { ok: true; order: Order } | { ok: false; reason: string; order?: Order };
export async function verifyScan(raw: string, outletId: string): Promise<ScanResult> {
  return verifyScanFn({ data: { raw, outletId } });
}

export async function confirmPickup(orderId: string) {
  const order = await confirmPickupFn({ data: { orderId } });
  await bump();
  return order;
}

export async function updateOutlet(id: string, patch: Partial<Outlet>) {
  await updateOutletFn({ data: { id, patch } });
  await bump();
}
export async function upsertMenuItem(item: MenuItem) {
  await upsertMenuItemFn({ data: { item } });
  await bump();
}
export async function deleteMenuItem(id: string) {
  await deleteMenuItemFn({ data: { id } });
  await bump();
}
export async function updateLoyalty(rule: LoyaltyRule) {
  await updateLoyaltyFn({ data: { rule } });
  await bump();
}
export async function saveCoupon(coupon: Coupon) {
  await saveCouponFn({ data: { coupon } });
  await bump();
}
export async function deleteCoupon(id: string) {
  await deleteCouponFn({ data: { id } });
  await bump();
}
export async function updateSettings(settings: ShopSettings) {
  await updateSettingsFn({ data: { settings } });
  await bump();
}
export async function adjustPoints(phone: string, delta: number, reason: string) {
  await adjustPointsFn({ data: { phone, delta, reason } });
  await bump();
}
export async function saveMessage(input: {
  name: string;
  phone: string;
  message: string;
  outletId: string | null;
}) {
  const message = await saveMessageFn({ data: input });
  await bump();
  return message;
}

export async function loadProduct(slug: string) {
  return loadProductFn({ data: { slug } });
}

export async function getAnalytics(
  outletId: string | "all",
  period: Period,
  range?: { from?: number; to?: number },
) {
  return getAnalyticsFn({
    data: {
      outletId,
      period: period === "year" ? "year" : period,
      ...(range?.from ? { from: range.from } : {}),
      ...(range?.to ? { to: range.to } : {}),
    },
  });
}

export async function ready() {
  return readyFn();
}

export async function staffLogin(username: string, password: string) {
  const staff = await staffLoginFn({ data: { username, password } });
  setSession((s) => ({ ...s, staff }));
  await bump();
  return staff;
}
export function staffLogout() {
  void staffLogoutFn();
  setSession((s) => ({ ...s, staff: null }));
}

export async function addWorker(input: {
  outletId: string;
  name: string;
  phone?: string;
  role: KitchenWorker["role"];
}) {
  const worker = await addWorkerFn({ data: input });
  await bump();
  return worker;
}
export async function setWorkerActive(id: string, active: boolean) {
  await setWorkerActiveFn({ data: { id, active } });
  await bump();
}
export async function clockWorker(workerId: string, action: "in" | "out") {
  const rec = await clockWorkerFn({ data: { workerId, action } });
  await bump();
  return rec;
}
export async function setItemPrep(itemId: string, prepMinutes: number) {
  const item = await setItemPrepFn({ data: { itemId, prepMinutes } });
  await bump();
  return item;
}

export async function loadShop() {
  return getShopFn();
}
