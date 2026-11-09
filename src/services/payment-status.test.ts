import { describe, expect, it } from "vitest";
import { countsTowardKitchen, orderPaymentStatus, paymentCaption } from "./payment-status";

describe("payment status", () => {
  it("keeps counter orders unpaid until someone marks them collected", () => {
    expect(orderPaymentStatus({ payment: "counter", paid: false })).toBe("UNPAID");
    expect(paymentCaption({ payment: "counter", paid: false })).toBe("To pay at counter");
    expect(countsTowardKitchen({ payment: "counter", paid: false })).toBe(true);
  });

  it("hides an online order from the kitchen until it is paid", () => {
    expect(countsTowardKitchen({ payment: "online", paid: false, paymentStatus: "PENDING" })).toBe(false);
    expect(countsTowardKitchen({ payment: "online", paid: true, paymentStatus: "PAID" })).toBe(true);
    expect(paymentCaption({ payment: "online", paid: false, paymentStatus: "FAILED" })).toBe("Payment failed");
  });
});
