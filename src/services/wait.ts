import type { AttendanceRecord, KitchenWorker, Order, Outlet } from "./types";

const COOKING: Order["status"][] = ["Placed", "Accepted", "Preparing"];
const BOARD: Order["status"][] = ["Placed", "Accepted", "Preparing", "Ready"];

export function clockedInCount(
  workers: KitchenWorker[],
  attendance: AttendanceRecord[],
  outletId: string,
  now = Date.now(),
  roles?: KitchenWorker["role"][],
) {
  const live = new Set(
    attendance
      .filter((a) => a.outletId === outletId && a.clockIn <= now && !a.clockOut)
      .map((a) => a.workerId),
  );
  return workers.filter(
    (w) =>
      w.outletId === outletId &&
      w.active &&
      live.has(w.id) &&
      (!roles || roles.includes(w.role)),
  ).length;
}

export function minutesPerOrder(
  outlet: Pick<Outlet, "waitMinutes" | "minutesPerOrder" | "fallbackWaitMinutes"> | undefined,
) {
  const n = outlet?.minutesPerOrder ?? outlet?.fallbackWaitMinutes ?? outlet?.waitMinutes ?? 10;
  return Math.max(1, Math.round(n));
}

function byOldest(a: Order, b: Order) {
  return a.createdAt - b.createdAt || a.number - b.number;
}

/** Kitchen board: oldest first, including ready-for-pickup. */
export function liveQueue(orders: Order[], outletId: string) {
  return orders.filter((o) => o.outletId === outletId && BOARD.includes(o.status)).sort(byOldest);
}

/** Tickets still occupying a cook slot (not handed over, not sitting ready). */
export function cookQueue(orders: Order[], outletId: string) {
  return orders.filter((o) => o.outletId === outletId && COOKING.includes(o.status)).sort(byOldest);
}

/** 5 tickets already cooking → the next (6th) is 6 × minutesPerOrder. */
export function waitForNewOrder(orders: Order[], outletId: string, perOrder: number) {
  return (cookQueue(orders, outletId).length + 1) * Math.max(1, perOrder);
}

export function waitForOrder(orders: Order[], outletId: string, orderId: string, perOrder: number) {
  const i = cookQueue(orders, outletId).findIndex((o) => o.id === orderId);
  if (i < 0) return 0;
  return (i + 1) * Math.max(1, perOrder);
}
