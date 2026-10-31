import type { Order, Outlet } from "./types";

export function isWithinHours(o: Outlet, d = new Date()) {
  const h = d.getHours();
  return h >= o.openHour && h < o.closeHour;
}

/** Live open flag. Kitchen/owner can force-open after hours. */
export function isOpenNow(o: Outlet, d = new Date()) {
  if (!o.isOpen) return false;
  if (o.forceOpen) return true;
  return isWithinHours(o, d);
}
export function canOrder(o: Outlet, d = new Date()) {
  return isOpenNow(o, d) && !o.pauseOrders;
}
export function busyness(o: Outlet, orders: Order[]) {
  const active = orders.filter(
    (x) => x.outletId === o.id && ["Placed", "Accepted", "Preparing"].includes(x.status),
  ).length;
  return { active, label: active >= 6 ? "Busy" : active >= 3 ? "Steady" : "Quiet" } as const;
}
