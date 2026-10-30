import type { Order, OrderStatus } from "./types";

export interface ScanOrder {
  id: string;
  number: number;
  outletId: string;
  status: OrderStatus;
  qrToken?: string | undefined;
  qrUsed?: boolean | undefined;
}

export type ScanVerdict =
  { ok: true; order: ScanOrder } | { ok: false; reason: string; order?: ScanOrder | undefined };

/** Single-use pickup QR. A plain order number is the manual fallback. */
export function evaluateScan(orders: ScanOrder[], raw: string, outletId: string): ScanVerdict {
  const trimmed = raw.trim();
  let order: ScanOrder | undefined;
  let token: string | undefined;
  let tokenChecked = false;

  try {
    const parsed = JSON.parse(trimmed) as { id?: string; t?: string; o?: string };
    if (parsed && typeof parsed === "object" && (parsed.id || parsed.t)) {
      tokenChecked = true;
      order = orders.find((o) => o.id === parsed.id);
      token = parsed.t;
      if (order && parsed.o && parsed.o !== order.outletId) {
        return { ok: false, reason: "Wrong outlet", order };
      }
      if (order && order.qrToken !== token) return { ok: false, reason: "Invalid QR", order };
      if (!order) return { ok: false, reason: "Invalid QR" };
    }
  } catch {
    tokenChecked = false;
  }

  if (!order) {
    const n = Number(trimmed.replace(/\D/g, ""));
    if (!n) return { ok: false, reason: tokenChecked ? "Invalid QR" : "No order found" };
    order = orders.find((o) => o.number === n);
  }

  if (!order) return { ok: false, reason: "No order found" };
  if (order.outletId !== outletId) return { ok: false, reason: "Wrong outlet", order };
  if (order.qrUsed || order.status === "Collected")
    return { ok: false, reason: "This QR was already used", order };
  if (order.status === "Rejected") return { ok: false, reason: "Order was rejected", order };
  if (order.status !== "Ready")
    return { ok: false, reason: "Order isn't ready for pickup yet", order };
  return { ok: true, order };
}

export function qrPayload(order: Pick<Order, "id" | "outletId" | "qrToken">) {
  return JSON.stringify({ id: order.id, o: order.outletId, t: order.qrToken });
}
