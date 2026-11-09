import { createHash } from "node:crypto";
import { uid } from "@/lib/id";
import type { CartLine, Order, PaymentStatus } from "@/services/types";
import { orderPaymentStatus } from "@/services/payment-status";
import { exec, serialize } from "./db";
import {
  getOrderById,
  grantOrderBenefits,
  markCounterPaymentCollected,
  placeOrderUnlocked,
} from "./repo";
import type { AuthSession } from "./session";
import {
  captureDecision,
  createProviderOrder,
  ensureCaptured,
  fetchProviderPayment,
  paymentSettlePlan,
  publicKeyId,
  razorpayConfig,
  rupeesToPaise,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  type RazorpayPaymentEntity,
} from "./razorpay";

const REUSE_MS = 2 * 60 * 60 * 1000;

export type CheckoutSession =
  | { alreadyPaid: true; orderId: string; number: number; totalRupees: number }
  | {
      alreadyPaid: false;
      orderId: string;
      number: number;
      totalRupees: number;
      keyId: string;
      razorpayOrderId: string;
      amountPaise: number;
      currency: "INR";
      prefillName: string;
      prefillContact: string;
    };

export type OnlineCheckoutInput = {
  name: string;
  notes?: string;
  scheduledFor?: number;
  cart: CartLine[];
  outletId: string | null;
  redeemStepId: string | null;
  couponCode: string | null;
  checkoutKey: string;
};

type PaymentRow = {
  id: string;
  orderId: string;
  checkoutKey: string | null;
  fingerprint: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  method: string;
  status: string;
  amountPaise: number;
  currency: string;
  error: string | null;
};

function rec(row: object) {
  return row as Record<string, unknown>;
}
function s(row: object, key: string) {
  const v = rec(row)[key];
  return v == null ? "" : String(v);
}
function maybe(row: object, key: string) {
  const v = rec(row)[key];
  return typeof v === "string" && v ? v : null;
}
function num(row: object, key: string) {
  return Number(rec(row)[key] ?? 0);
}

function mapPayment(row: object): PaymentRow {
  return {
    id: s(row, "id"),
    orderId: s(row, "order_id"),
    checkoutKey: maybe(row, "checkout_key"),
    fingerprint: maybe(row, "fingerprint"),
    razorpayOrderId: maybe(row, "razorpay_order_id"),
    razorpayPaymentId: maybe(row, "razorpay_payment_id"),
    method: s(row, "method"),
    status: s(row, "status"),
    amountPaise: num(row, "amount_paise"),
    currency: s(row, "currency") || "INR",
    error: maybe(row, "error"),
  };
}

function assertCheckoutKey(key: string) {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new Error("Checkout session is invalid. Refresh and try again.");
}

function cartFingerprint(input: OnlineCheckoutInput) {
  const body = JSON.stringify({
    outletId: input.outletId,
    name: input.name.trim(),
    notes: input.notes?.trim() ?? "",
    coupon: input.couponCode?.trim().toLowerCase() ?? "",
    redeem: input.redeemStepId ?? "",
    lines: input.cart.map((line) => ({
      id: line.itemId,
      size: line.size ?? "",
      toppings: [...line.toppings].sort(),
      qty: line.qty,
      note: line.note ?? "",
    })),
  });
  return createHash("sha256").update(body).digest("hex");
}

function customerPhone(auth: AuthSession | null) {
  if (auth?.kind !== "customer" || !auth.phone) throw new Error("Sign in to place an order.");
  return auth.phone;
}

async function paymentByCheckoutKey(key: string) {
  const rs = await exec("SELECT * FROM payments WHERE checkout_key = ?", [key]);
  return rs.rows[0] ? mapPayment(rs.rows[0]) : null;
}

async function paymentByRazorpayOrder(razorpayOrderId: string) {
  const rs = await exec("SELECT * FROM payments WHERE razorpay_order_id = ?", [razorpayOrderId]);
  return rs.rows[0] ? mapPayment(rs.rows[0]) : null;
}

async function latestOnlinePayment(orderId: string) {
  const rs = await exec(
    "SELECT * FROM payments WHERE order_id = ? AND method = 'PAY_ONLINE' ORDER BY created_at DESC LIMIT 1",
    [orderId],
  );
  return rs.rows[0] ? mapPayment(rs.rows[0]) : null;
}

async function reusablePayment(phone: string, fingerprint: string) {
  const rs = await exec(
    `SELECT p.* FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE p.fingerprint = ? AND o.phone = ? AND p.method = 'PAY_ONLINE' AND p.created_at > ?
     ORDER BY p.created_at DESC LIMIT 1`,
    [fingerprint, phone, Date.now() - REUSE_MS],
  );
  return rs.rows[0] ? mapPayment(rs.rows[0]) : null;
}

function sessionFrom(order: Order, payment: PaymentRow): CheckoutSession {
  if (order.paid) {
    return { alreadyPaid: true, orderId: order.id, number: order.number, totalRupees: order.total };
  }
  if (!payment.razorpayOrderId) throw new Error("Payment is still being prepared. Try again.");
  const keyId = publicKeyId();
  return {
    alreadyPaid: false,
    orderId: order.id,
    number: order.number,
    totalRupees: order.total,
    keyId,
    razorpayOrderId: payment.razorpayOrderId,
    amountPaise: payment.amountPaise,
    currency: "INR",
    prefillName: order.customerName,
    prefillContact: order.phone,
  };
}

async function attachRazorpayOrder(order: Order, payment: PaymentRow) {
  if (payment.razorpayOrderId) return sessionFrom(order, payment);
  const created = await createProviderOrder({
    amountPaise: payment.amountPaise,
    receipt: order.id,
    grizzlyOrderId: order.id,
  });
  const now = Date.now();
  await exec(
    `UPDATE payments SET razorpay_order_id = ?, status = 'PENDING', updated_at = ?, error = NULL WHERE id = ?`,
    [created.id, now, payment.id],
  );
  const next: Order = { ...order, razorpayOrderId: created.id, paymentStatus: "PENDING" };
  const { saveOrder } = await import("./repo");
  await saveOrder(next);
  return sessionFrom(next, { ...payment, razorpayOrderId: created.id, status: "PENDING" });
}

export async function startOnlineCheckout(auth: AuthSession | null, input: OnlineCheckoutInput) {
  const phone = customerPhone(auth);
  assertCheckoutKey(input.checkoutKey);
  publicKeyId();
  const fingerprint = cartFingerprint(input);
  return serialize(async () => {
    const byKey = await paymentByCheckoutKey(input.checkoutKey);
    if (byKey?.fingerprint && byKey.fingerprint !== fingerprint) {
      throw new Error("Your order changed. Go back one step and try again.");
    }
    const existing = byKey ?? (await reusablePayment(phone, fingerprint));
    if (existing) {
      const order = await getOrderById(existing.orderId);
      if (!order || order.phone !== phone) throw new Error("That checkout belongs to another customer.");
      if (order.paid) {
        return { alreadyPaid: true, orderId: order.id, number: order.number, totalRupees: order.total } satisfies CheckoutSession;
      }
      return attachRazorpayOrder(order, existing);
    }

    const order = await placeOrderUnlocked(auth, {
      payment: "online",
      awaitPayment: true,
      name: input.name,
      cart: input.cart,
      outletId: input.outletId,
      redeemStepId: input.redeemStepId,
      couponCode: input.couponCode,
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.scheduledFor ? { scheduledFor: input.scheduledFor } : {}),
    });
    const amountPaise = rupeesToPaise(order.total);
    const now = Date.now();
    const id = `pay_${uid()}`;
    await exec(
      `INSERT INTO payments
        (id, order_id, checkout_key, fingerprint, method, status, amount_paise, currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'PAY_ONLINE', 'PENDING', ?, 'INR', ?, ?)`,
      [id, order.id, input.checkoutKey, fingerprint, amountPaise, now, now],
    );
    return attachRazorpayOrder(order, {
      id,
      orderId: order.id,
      checkoutKey: input.checkoutKey,
      fingerprint,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      method: "PAY_ONLINE",
      status: "PENDING",
      amountPaise,
      currency: "INR",
      error: null,
    });
  });
}

export async function resumeOnlineCheckout(auth: AuthSession | null, orderId: string) {
  const phone = customerPhone(auth);
  return serialize(async () => {
    const order = await getOrderById(orderId);
    if (!order || order.phone !== phone) throw new Error("Order not found.");
    if (order.payment !== "online") throw new Error("This order is paid at the counter.");
    if (order.paid) {
      return { alreadyPaid: true, orderId: order.id, number: order.number, totalRupees: order.total } satisfies CheckoutSession;
    }
    const payment = await latestOnlinePayment(order.id);
    if (!payment) throw new Error("This order has no online payment to retry.");
    return attachRazorpayOrder(order, payment);
  });
}

export async function recordCounterPayment(order: Order) {
  const existing = await exec(
    "SELECT id FROM payments WHERE order_id = ? AND method = 'PAY_AT_COUNTER' LIMIT 1",
    [order.id],
  );
  if (existing.rows.length) return;
  const now = Date.now();
  await exec(
    `INSERT INTO payments
      (id, order_id, method, status, amount_paise, currency, created_at, updated_at)
     VALUES (?, ?, 'PAY_AT_COUNTER', 'UNPAID', ?, 'INR', ?, ?)`,
    [`pay_${uid()}`, order.id, rupeesToPaise(order.total), now, now],
  );
}

async function setPaymentRow(input: {
  id: string;
  status: string;
  razorpayPaymentId?: string | null;
  error?: string | null;
  paidAt?: number | null;
}) {
  const now = Date.now();
  await exec(
    `UPDATE payments
     SET status = ?, razorpay_payment_id = COALESCE(?, razorpay_payment_id), error = ?, paid_at = COALESCE(?, paid_at), updated_at = ?
     WHERE id = ?`,
    [input.status, input.razorpayPaymentId ?? null, input.error ?? null, input.paidAt ?? null, now, input.id],
  );
}

async function insertDuplicatePayment(order: Order, payment: RazorpayPaymentEntity) {
  const now = Date.now();
  try {
    await exec(
      `INSERT INTO payments
        (id, order_id, razorpay_order_id, razorpay_payment_id, method, status, amount_paise, currency, created_at, updated_at, paid_at, error)
       VALUES (?, ?, ?, ?, 'PAY_ONLINE', 'PAID', ?, 'INR', ?, ?, ?, ?)`,
      [
        `pay_${uid()}`,
        order.id,
        payment.order_id,
        payment.id,
        Number(payment.amount),
        now,
        now,
        now,
        "Duplicate capture. Review it in the Razorpay dashboard. The restaurant order was not duplicated.",
      ],
    );
  } catch (error) {
    if (!String(error).includes("UNIQUE")) throw error;
  }
  console.error("[razorpay] duplicate capture", { orderId: order.id, paymentId: payment.id });
}

export async function settleCapturedPayment(input: {
  razorpayOrderId: string;
  payment: RazorpayPaymentEntity;
}) {
  const row = await paymentByRazorpayOrder(input.razorpayOrderId);
  if (!row) throw new Error("No matching order for this payment.");
  const decision = captureDecision({
    expectedRazorpayOrderId: input.razorpayOrderId,
    expectedPaise: row.amountPaise,
    payment: input.payment,
  });
  if (!decision.ok) {
    if (decision.reason !== "Payment is not captured.") {
      await markAttemptFailed(input.razorpayOrderId, input.payment, decision.reason);
    }
    throw new Error(decision.reason);
  }
  if (row.currency !== "INR") {
    await setPaymentRow({ id: row.id, status: row.status, error: "Currency is not INR." });
    throw new Error("Currency is not INR.");
  }

  const order = await getOrderById(row.orderId);
  if (!order) throw new Error("Order not found.");
  const plan = paymentSettlePlan({
    orderPaid: order.paid,
    existingPaymentId: order.razorpayPaymentId ?? row.razorpayPaymentId,
    incomingPaymentId: input.payment.id,
    captured: true,
  });
  if (plan === "already-paid") return order;
  if (plan === "duplicate-capture") {
    await insertDuplicatePayment(order, input.payment);
    return order;
  }

  const paid = await grantOrderBenefits(order, {
    paid: true,
    paymentStatus: "PAID",
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.payment.id,
  });
  await setPaymentRow({
    id: row.id,
    status: "PAID",
    razorpayPaymentId: input.payment.id,
    error: null,
    paidAt: Date.now(),
  });
  return paid;
}

async function markAttemptFailed(razorpayOrderId: string, payment: RazorpayPaymentEntity, reason: string) {
  const row = await paymentByRazorpayOrder(razorpayOrderId);
  if (!row) return;
  const order = await getOrderById(row.orderId);
  if (order?.paid) return;
  const safe = reason.slice(0, 180);
  await setPaymentRow({ id: row.id, status: "FAILED", razorpayPaymentId: payment.id, error: safe });
  if (order && order.paymentStatus !== "PAID") {
    const { saveOrder } = await import("./repo");
    await saveOrder({ ...order, paymentStatus: "FAILED", razorpayOrderId });
  }
}

export async function verifyOnlinePayment(
  auth: AuthSession | null,
  input: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
) {
  const phone = customerPhone(auth);
  const cfg = razorpayConfig();
  const signatureOk = verifyCheckoutSignature({
    secret: cfg.keySecret,
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  });
  if (!signatureOk) throw new Error("Payment could not be verified.");

  return serialize(async () => {
    const order = await getOrderById(input.orderId);
    if (!order || order.phone !== phone) throw new Error("Order not found.");
    if (order.payment !== "online") throw new Error("This order is paid at the counter.");
    const row = await paymentByRazorpayOrder(input.razorpayOrderId);
    if (!row || row.orderId !== order.id) throw new Error("Payment does not match this order.");
    let payment = await fetchProviderPayment(input.razorpayPaymentId);
    if (payment.order_id !== input.razorpayOrderId) throw new Error("Payment does not match this order.");
    payment = await ensureCaptured(payment, row.amountPaise);
    return settleCapturedPayment({ razorpayOrderId: input.razorpayOrderId, payment });
  });
}

export async function paymentStatus(auth: { customer: AuthSession | null; staff: AuthSession | null }, orderId: string) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found.");
  const customerOk = auth.customer?.kind === "customer" && auth.customer.phone === order.phone;
  const staff = auth.staff?.kind === "staff" ? auth.staff : null;
  const staffOk =
    !!staff && (staff.role === "owner" || !staff.outletId || staff.outletId === order.outletId);
  if (!customerOk && !staffOk) throw new Error("Order not found.");
  const payment = await latestOnlinePayment(order.id);
  const counter = await exec(
    "SELECT * FROM payments WHERE order_id = ? AND method = 'PAY_AT_COUNTER' LIMIT 1",
    [order.id],
  );
  const row = payment ?? (counter.rows[0] ? mapPayment(counter.rows[0]) : null);
  return {
    orderId: order.id,
    number: order.number,
    payment: order.payment,
    paymentStatus: orderPaymentStatus(order) satisfies PaymentStatus,
    paid: order.paid,
    amountPaise: row?.amountPaise ?? rupeesToPaise(order.total),
    currency: "INR" as const,
    razorpayOrderId: order.razorpayOrderId ?? null,
    razorpayPaymentId: order.razorpayPaymentId ?? null,
  };
}

export async function collectCounterPayment(auth: AuthSession | null, orderId: string) {
  return markCounterPaymentCollected(auth, orderId);
}

function safeEventPayload(event: string, payment: RazorpayPaymentEntity | null) {
  return {
    event,
    paymentId: payment?.id ?? null,
    orderId: payment?.order_id ?? null,
    amount: payment ? Number(payment.amount) : null,
    currency: payment?.currency ?? null,
    status: payment?.status ?? null,
    errorCode: payment?.error_code ?? null,
    errorDescription: payment?.error_description?.slice(0, 180) ?? null,
  };
}

function readPaymentEntity(payload: unknown): RazorpayPaymentEntity | null {
  if (!payload || typeof payload !== "object") return null;
  const payment = (payload as { payment?: { entity?: unknown } }).payment?.entity;
  if (!payment || typeof payment !== "object") return null;
  const entity = payment as Record<string, unknown>;
  if (typeof entity["id"] !== "string" || typeof entity["order_id"] !== "string") return null;
  return {
    id: entity["id"],
    order_id: entity["order_id"],
    amount: Number(entity["amount"] ?? 0),
    currency: typeof entity["currency"] === "string" ? entity["currency"] : "",
    status: typeof entity["status"] === "string" ? entity["status"] : "",
    ...(typeof entity["captured"] === "boolean" ? { captured: entity["captured"] } : {}),
    ...(typeof entity["error_code"] === "string" ? { error_code: entity["error_code"] } : {}),
    ...(typeof entity["error_description"] === "string"
      ? { error_description: entity["error_description"] }
      : {}),
  };
}

export async function handleRazorpayWebhook(request: Request) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawBody = await request.text();
  if (!rawBody || rawBody.length > 200_000) return new Response("Bad request", { status: 400 });

  let cfg: ReturnType<typeof razorpayConfig>;
  try {
    cfg = razorpayConfig();
  } catch {
    console.error("[razorpay-webhook] Razorpay is not configured");
    return new Response("Webhook not configured", { status: 503 });
  }
  if (!cfg.webhookSecret) {
    console.error("[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not configured");
    return new Response("Webhook not configured", { status: 503 });
  }
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(cfg.webhookSecret, rawBody, signature)) {
    console.error("[razorpay-webhook] invalid signature");
    return new Response("Invalid signature", { status: 400 });
  }

  let parsed: { event?: unknown; payload?: unknown };
  try {
    parsed = JSON.parse(rawBody) as typeof parsed;
  } catch {
    return new Response("Malformed JSON", { status: 400 });
  }
  const event = typeof parsed.event === "string" ? parsed.event : "";
  if (!event) return new Response("Missing event", { status: 400 });

  const headerId = request.headers.get("x-razorpay-event-id")?.trim();
  const eventId = headerId || createHash("sha256").update(rawBody).digest("hex");
  const seen = await exec("SELECT id FROM razorpay_events WHERE event_id = ?", [eventId]);
  if (seen.rows.length) return Response.json({ ok: true, duplicate: true });

  const payment = readPaymentEntity(parsed.payload);
  const interesting = event === "payment.captured" || event === "order.paid" || event === "payment.authorized" || event === "payment.failed";

  try {
    if (interesting && payment) {
      await serialize(async () => {
        if (event === "payment.failed") {
          await markAttemptFailed(payment.order_id, payment, payment.error_description || "Payment failed.");
          return;
        }
        const row = await paymentByRazorpayOrder(payment.order_id);
        const expected = row?.amountPaise ?? Number(payment.amount);
        const captured = await ensureCaptured(payment, expected);
        await settleCapturedPayment({ razorpayOrderId: payment.order_id, payment: captured });
      });
    }
  } catch (error) {
    console.error("[razorpay-webhook] processing failed", {
      event,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return new Response("Processing failed", { status: 500 });
  }

  try {
    await exec(
      `INSERT INTO razorpay_events (id, event_id, event_type, razorpay_payment_id, payload, received_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`rz_${uid()}`, eventId, event, payment?.id ?? null, JSON.stringify(safeEventPayload(event, payment)), Date.now()],
    );
  } catch (error) {
    if (!String(error).includes("UNIQUE")) throw error;
    return Response.json({ ok: true, duplicate: true });
  }

  return Response.json({ ok: true, duplicate: false });
}

export { markCounterPaymentCollected };
