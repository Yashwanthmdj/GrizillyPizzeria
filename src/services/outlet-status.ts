import type { Order, Outlet } from "./types";

export function isOpenNow(o: Outlet, d = new Date()) {
  const h = d.getHours();
  return o.isOpen && h >= o.openHour && h < o.closeHour;
}
export function canOrder(o: Outlet) {
  return isOpenNow(o) && !o.pauseOrders;
}
export function busyness(o: Outlet, orders: Order[]) {
  const active = orders.filter(
    (x) => x.outletId === o.id && ["Placed", "Accepted", "Preparing"].includes(x.status),
  ).length;
  return { active, label: active >= 6 ? "Busy" : active >= 3 ? "Steady" : "Quiet" } as const;
}
