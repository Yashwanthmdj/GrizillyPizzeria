import type { Order, PaymentStatus } from "./types";

type PaymentFields = Pick<Order, "payment" | "paid" | "paymentStatus">;

/** Orders placed before Razorpay still read correctly. */
export function orderPaymentStatus(order: PaymentFields): PaymentStatus {
  if (order.paymentStatus) return order.paymentStatus;
  if (order.paid) return "PAID";
  return order.payment === "counter" ? "UNPAID" : "PENDING";
}

export function paymentCaption(order: PaymentFields) {
  const status = orderPaymentStatus(order);
  if (order.payment === "online") {
    if (status === "PAID") return "Paid online";
    if (status === "FAILED") return "Payment failed";
    if (status === "CANCELLED") return "Payment cancelled";
    return "Payment pending";
  }
  return status === "PAID" ? "Paid at counter" : "To pay at counter";
}

/** Online tickets stay off the kitchen board until Razorpay confirms the capture. */
export function countsTowardKitchen(order: PaymentFields) {
  if (order.payment === "online" && !order.paid) return false;
  return true;
}
