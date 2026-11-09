import { describe, expect, it } from "vitest";
import { orderConfirmationKey } from "./whatsapp-outbox";
import {
  assertKeyMode,
  captureDecision,
  paymentSettlePlan,
  rupeesToPaise,
  signCheckout,
  signWebhook,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "./razorpay";

const SECRET = "test_secret_value";

describe("razorpay amounts and signatures", () => {
  it("stores rupees as integer paise", () => {
    expect(rupeesToPaise(259)).toBe(25900);
    expect(rupeesToPaise(10.5)).toBe(1050);
    expect(() => rupeesToPaise(Number.NaN)).toThrow(/invalid/i);
  });

  it("accepts a checkout signature and rejects a forged one", () => {
    const signature = signCheckout(SECRET, "order_123", "pay_123");
    expect(
      verifyCheckoutSignature({
        secret: SECRET,
        razorpayOrderId: "order_123",
        razorpayPaymentId: "pay_123",
        signature,
      }),
    ).toBe(true);
    expect(
      verifyCheckoutSignature({
        secret: SECRET,
        razorpayOrderId: "order_123",
        razorpayPaymentId: "pay_123",
        signature: `${signature.slice(0, -1)}a`,
      }),
    ).toBe(false);
    expect(
      verifyCheckoutSignature({
        secret: "other",
        razorpayOrderId: "order_123",
        razorpayPaymentId: "pay_123",
        signature,
      }),
    ).toBe(false);
  });

  it("verifies the webhook against the raw body", () => {
    const raw = '{"event":"payment.captured"}';
    const signature = signWebhook(SECRET, raw);
    expect(verifyWebhookSignature(SECRET, raw, signature)).toBe(true);
    expect(verifyWebhookSignature(SECRET, `${raw} `, signature)).toBe(false);
    expect(verifyWebhookSignature("", raw, signature)).toBe(false);
    expect(verifyWebhookSignature(SECRET, raw, null)).toBe(false);
  });

  it("marks paid only when the captured payment matches the order and the bill", () => {
    const payment = {
      order_id: "order_123",
      amount: 25900,
      currency: "INR",
      status: "captured",
    };
    expect(
      captureDecision({ expectedRazorpayOrderId: "order_123", expectedPaise: 25900, payment }).ok,
    ).toBe(true);
    expect(
      captureDecision({
        expectedRazorpayOrderId: "order_123",
        expectedPaise: 100,
        payment,
      }),
    ).toEqual({ ok: false, reason: "Paid amount does not match the bill." });
    expect(
      captureDecision({
        expectedRazorpayOrderId: "order_other",
        expectedPaise: 25900,
        payment,
      }).ok,
    ).toBe(false);
    expect(
      captureDecision({
        expectedRazorpayOrderId: "order_123",
        expectedPaise: 25900,
        payment: { ...payment, status: "failed", currency: "INR" },
      }).ok,
    ).toBe(false);
    expect(
      captureDecision({
        expectedRazorpayOrderId: "order_123",
        expectedPaise: 25900,
        payment: { ...payment, currency: "USD" },
      }).ok,
    ).toBe(false);
  });

  it("treats a repeated capture as already paid and a second capture as a duplicate", () => {
    expect(
      paymentSettlePlan({
        orderPaid: true,
        existingPaymentId: "pay_1",
        incomingPaymentId: "pay_1",
        captured: true,
      }),
    ).toBe("already-paid");
    expect(
      paymentSettlePlan({
        orderPaid: true,
        existingPaymentId: "pay_1",
        incomingPaymentId: "pay_2",
        captured: true,
      }),
    ).toBe("duplicate-capture");
    expect(
      paymentSettlePlan({
        orderPaid: false,
        existingPaymentId: null,
        incomingPaymentId: "pay_1",
        captured: true,
      }),
    ).toBe("mark-paid");
    expect(
      paymentSettlePlan({
        orderPaid: false,
        incomingPaymentId: "pay_1",
        captured: false,
      }),
    ).toBe("reject");
  });

  it("uses one WhatsApp confirmation key per order", () => {
    expect(orderConfirmationKey("ord_1")).toBe("order_confirm:ord_1");
    expect(orderConfirmationKey("ord_1")).toBe(orderConfirmationKey("ord_1"));
    expect(orderConfirmationKey("ord_1")).not.toBe(orderConfirmationKey("ord_2"));
  });

  it("blocks a live key while test mode is on", () => {
    expect(() => assertKeyMode("rzp_live_example", "test")).toThrow(/test mode/i);
    expect(() => assertKeyMode("rzp_test_example", "test")).not.toThrow();
    expect(() => assertKeyMode("rzp_test_example", "live")).toThrow(/test key/i);
  });
});
