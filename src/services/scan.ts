import type { LineStatus, Order, OrderStatus } from "./types";

export interface ScanOrder {
  id: string;
  number: number;
  outletId: string;
  status: OrderStatus;
  qrToken?: string | undefined;
  qrUsed?: boolean | undefined;
  lines?: { lineStatus?: LineStatus | undefined }[] | undefined;
}

export type ScanVerdict =
  { ok: true; order: ScanOrder } | { ok: false; reason: string; order?: ScanOrder | undefined };

function readyUncollected(order: ScanOrder) {
  const lines = order.lines ?? [];
  if (!lines.length) return order.status === "Ready" && !order.qrUsed;
  return lines.some((l) => (l.lineStatus ?? (order.status === "Ready" ? "ready" : "queued")) === "ready");
}

function fullyCollected(order: ScanOrder) {
  const lines = order.lines ?? [];
  if (!lines.length) return !!order.qrUsed || order.status === "Collected";
  return lines.every((l) => l.lineStatus === "collected");
}

/** Pickup QR. Ready items can be collected while slower items keep cooking. */
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
  if (order.status === "Rejected") return { ok: false, reason: "Order was rejected", order };
  if (fullyCollected(order) || order.status === "Collected")
    return { ok: false, reason: "Everything on this order is already handed over", order };
  if (!readyUncollected(order))
    return { ok: false, reason: "Nothing is ready for pickup yet", order };
  return { ok: true, order };
}

export function qrPayload(order: Pick<Order, "id" | "outletId" | "qrToken">) {
  return JSON.stringify({ id: order.id, o: order.outletId, t: order.qrToken });
}
