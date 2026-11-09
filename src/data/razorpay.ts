import { createHmac, timingSafeEqual } from "node:crypto";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

export type RazorpayMode = "test" | "live";

export type RazorpayPaymentEntity = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured?: boolean;
  error_code?: string | null;
  error_description?: string | null;
};

type RazorpayClient = {
  orders: {
    create: (body: Record<string, unknown>) => Promise<{ id: string; amount: number; currency: string }>;
  };
  payments: {
    fetch: (id: string) => Promise<RazorpayPaymentEntity>;
    capture: (id: string, amount: number, currency: string) => Promise<RazorpayPaymentEntity>;
  };
};

export function rupeesToPaise(rupees: number) {
  if (!Number.isFinite(rupees) || rupees < 0) throw new Error("Bill amount is invalid.");
  return Math.round(rupees * 100);
}

export function razorpayMode(): RazorpayMode {
  return process.env["RAZORPAY_MODE"]?.trim().toLowerCase() === "live" ? "live" : "test";
}

/** Refuses a live key while test mode is on, so a pasted live key cannot charge real cards. */
export function assertKeyMode(keyId: string, mode: RazorpayMode = razorpayMode()) {
  if (mode !== "live" && keyId.startsWith("rzp_live_")) {
    throw new Error(
      "Razorpay is in test mode. Paste the test key, or set RAZORPAY_MODE=live only when you mean to take real payments.",
    );
  }
  if (mode === "live" && keyId.startsWith("rzp_test_")) {
    throw new Error("RAZORPAY_MODE is live, but the key is a test key.");
  }
}

export function razorpayConfig() {
  const keyId = process.env["RAZORPAY_KEY_ID"]?.trim() ?? "";
  const keySecret = process.env["RAZORPAY_KEY_SECRET"]?.trim() ?? "";
  const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"]?.trim() ?? "";
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured yet.");
  assertKeyMode(keyId);
  return { keyId, keySecret, webhookSecret, mode: razorpayMode() };
}

export function publicKeyId() {
  return razorpayConfig().keyId;
}

export function signCheckout(secret: string, razorpayOrderId: string, razorpayPaymentId: string) {
  return signHmac(secret, `${razorpayOrderId}|${razorpayPaymentId}`);
}

export function signWebhook(secret: string, rawBody: string) {
  return signHmac(secret, rawBody);
}

function signHmac(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function safeEqualHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, "utf8");
    const right = Buffer.from(b, "utf8");
    if (left.length !== right.length || left.length === 0) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function verifyCheckoutSignature(input: {
  secret: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}) {
  if (!input.signature || !input.razorpayOrderId || !input.razorpayPaymentId) return false;
  const expected = signCheckout(input.secret, input.razorpayOrderId, input.razorpayPaymentId);
  return safeEqualHex(expected, input.signature);
}

export function verifyWebhookSignature(secret: string, rawBody: string, signature: string | null) {
  if (!secret || !signature) return false;
  return safeEqualHex(signWebhook(secret, rawBody), signature);
}

export function captureDecision(input: {
  expectedRazorpayOrderId: string;
  expectedPaise: number;
  payment: Pick<RazorpayPaymentEntity, "order_id" | "amount" | "currency" | "status" | "captured">;
}): { ok: true } | { ok: false; reason: string } {
  if (input.payment.currency !== "INR") return { ok: false, reason: "Currency is not INR." };
  if (input.payment.order_id !== input.expectedRazorpayOrderId) {
    return { ok: false, reason: "Payment does not match this order." };
  }
  if (Number(input.payment.amount) !== input.expectedPaise) {
    return { ok: false, reason: "Paid amount does not match the bill." };
  }
  const captured = input.payment.status === "captured" || input.payment.captured === true;
  if (!captured) return { ok: false, reason: "Payment is not captured." };
  return { ok: true };
}

export type SettlePlan = "already-paid" | "mark-paid" | "duplicate-capture" | "reject";

export function paymentSettlePlan(input: {
  orderPaid: boolean;
  existingPaymentId?: string | null;
  incomingPaymentId: string;
  captured: boolean;
}): SettlePlan {
  if (!input.captured) return "reject";
  if (input.orderPaid && input.existingPaymentId && input.existingPaymentId === input.incomingPaymentId) {
    return "already-paid";
  }
  if (input.orderPaid && input.existingPaymentId && input.existingPaymentId !== input.incomingPaymentId) {
    return "duplicate-capture";
  }
  if (input.orderPaid) return "already-paid";
  return "mark-paid";
}

let clientPromise: Promise<RazorpayClient> | null = null;

async function client() {
  if (!clientPromise) {
    const cfg = razorpayConfig();
    clientPromise = import("razorpay").then((mod) => {
      const Ctor = (mod.default ?? mod) as unknown as new (options: {
        key_id: string;
        key_secret: string;
      }) => RazorpayClient;
      return new Ctor({ key_id: cfg.keyId, key_secret: cfg.keySecret });
    });
    clientPromise.catch(() => {
      clientPromise = null;
    });
  }
  return clientPromise;
}

export async function createProviderOrder(input: { amountPaise: number; receipt: string; grizzlyOrderId: string }) {
  if (input.amountPaise < 100) throw new Error("Online payment needs a total of at least Rs 1.");
  try {
    const rz = await client();
    const created = await rz.orders.create({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: { grizzlyOrderId: input.grizzlyOrderId },
    });
    if (!created.id || created.currency !== "INR" || Number(created.amount) !== input.amountPaise) {
      throw new Error("Razorpay returned an unexpected order.");
    }
    return { id: created.id, amountPaise: Number(created.amount), currency: "INR" as const };
  } catch (error) {
    if (error instanceof Error && /not configured|test mode|test key|at least Rs 1|unexpected order/.test(error.message)) {
      throw error;
    }
    console.error("[razorpay] create order failed");
    throw new Error("Razorpay could not start the payment. Try again.");
  }
}

export async function fetchProviderPayment(paymentId: string) {
  try {
    const rz = await client();
    return await rz.payments.fetch(paymentId);
  } catch {
    console.error("[razorpay] fetch payment failed");
    throw new Error("Could not confirm the payment with Razorpay. Try again.");
  }
}

/** Authorized payments are captured here so the order is marked paid only after capture. */
export async function ensureCaptured(payment: RazorpayPaymentEntity, expectedPaise: number) {
  if (payment.status === "captured" || payment.captured === true) return payment;
  if (payment.status !== "authorized") return payment;
  if (payment.currency !== "INR" || Number(payment.amount) !== expectedPaise) return payment;
  try {
    const rz = await client();
    return await rz.payments.capture(payment.id, expectedPaise, "INR");
  } catch {
    console.error("[razorpay] capture failed");
    throw new Error("Razorpay could not capture the payment. Try again.");
  }
}
