import { rng } from "./rng";
import type { MenuItem, Order, OrderStatus, Outlet } from "./types";

export type Period = "today" | "week" | "month" | "year";

export interface AnalyticsPoint {
  label: string;
  revenue: number;
  orders: number;
}

export interface Analytics {
  sample: boolean;
  notice: string | null;
  revenue: number;
  orders: number;
  completed: number;
  rejected: number;
  pendingPayments: number;
  averageOrderValue: number;
  newCustomers: number;
  repeatCustomers: number;
  online: number;
  counter: number;
  revenueSeries: AnalyticsPoint[];
  byHour: { hour: string; orders: number }[];
  bestSellers: { name: string; qty: number }[];
  categories: { name: string; value: number }[];
  payments: { name: string; value: number }[];
  outlets: { name: string; revenue: number; orders: number }[];
  exportRows: string[][];
}

export function periodRange(period: Period, now: number) {
  const end = now;
  const startDate = new Date(now);
  if (period === "today") startDate.setHours(0, 0, 0, 0);
  else if (period === "week") startDate.setDate(startDate.getDate() - 6);
  else if (period === "month") startDate.setDate(startDate.getDate() - 29);
  else startDate.setFullYear(startDate.getFullYear() - 1);
  if (period !== "today") startDate.setHours(0, 0, 0, 0);
  return { start: startDate.getTime(), end };
}

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function uniqueDays(orders: Order[]) {
  return new Set(orders.map((o) => dayKey(o.createdAt))).size;
}

function isSparse(period: Period, orders: Order[]) {
  if (period === "today") return orders.length < 3;
  if (period === "week") return orders.length < 8;
  if (period === "month") return uniqueDays(orders) < 8;
  return uniqueDays(orders) < 20;
}

function sampleOrders(menu: MenuItem[], outlets: Outlet[], now: number): Order[] {
  const rand = rng(99);
  const pool = menu.length
    ? menu
    : [
        {
          id: "sample",
          name: "Sample pizza",
          category: "Pizzas" as const,
          price: 299,
          veg: true,
          description: "",
          image: "",
          availability: {},
          priceOverride: {},
        },
      ];
  const outletIds = outlets.length ? outlets.map((o) => o.id) : ["o1", "o2"];
  const orders: Order[] = [];
  let number = 5000;
  for (let day = 364; day >= 0; day--) {
    if (rand() < 0.18) continue;
    const count = 1 + Math.floor(rand() * 4);
    for (let n = 0; n < count; n++) {
      const created = new Date(now);
      created.setDate(created.getDate() - day);
      created.setHours(11 + Math.floor(rand() * 12), Math.floor(rand() * 60), 0, 0);
      const createdAt = created.getTime();
      if (createdAt > now) continue;
      const item = pool[Math.floor(rand() * pool.length)]!;
      const qty = 1 + Math.floor(rand() * 2);
      const unit =
        item.price + (item.category === "Pizzas" ? [0, 120, 240][Math.floor(rand() * 3)]! : 0);
      const subtotal = unit * qty;
      const tax = Math.round(subtotal * 0.05);
      const online = rand() > 0.42;
      const rejected = rand() < 0.06;
      const status: OrderStatus = rejected ? "Rejected" : "Collected";
      const phone = `98000${String(Math.floor(rand() * 24)).padStart(5, "0")}`;
      orders.push({
        id: `sample_${number}`,
        number: number++,
        outletId: outletIds[Math.floor(rand() * outletIds.length)]!,
        customerName: "Sample guest",
        phone,
        lines: [
          {
            key: `${item.id}-${number}`,
            itemId: item.id,
            name: item.name,
            image: item.image,
            veg: item.veg,
            toppings: [],
            unitPrice: unit,
            qty,
          },
        ],
        subtotal,
        tax,
        discount: 0,
        packaging: 0,
        couponDiscount: 0,
        total: subtotal + tax,
        pointsUsed: 0,
        pointsEarned: Math.floor(subtotal / 100) * 10,
        payment: online ? "online" : "counter",
        paid: !rejected,
        status,
        history: [{ status, at: createdAt }],
        createdAt,
        promisedAt: createdAt + 20 * 60_000,
        rejectReason: rejected ? "SAMPLE: out of dough" : undefined,
      });
    }
  }
  return orders;
}

function seriesFor(
  period: Period,
  orders: Order[],
  range: { start: number; end: number },
): AnalyticsPoint[] {
  const paid = orders.filter((o) => o.status !== "Rejected");
  if (period === "today") {
    return Array.from({ length: 24 }, (_, hour) => {
      const list = paid.filter((o) => new Date(o.createdAt).getHours() === hour);
      return {
        label: `${hour}`,
        revenue: list.reduce((s, o) => s + o.total, 0),
        orders: list.length,
      };
    });
  }
  if (period === "year") {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(range.end);
      d.setDate(1);
      d.setMonth(d.getMonth() - (11 - i));
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const list = paid.filter((o) => {
        const x = new Date(o.createdAt);
        return `${x.getFullYear()}-${x.getMonth()}` === key;
      });
      return {
        label: d.toLocaleString("en-IN", { month: "short" }),
        revenue: list.reduce((s, o) => s + o.total, 0),
        orders: list.length,
      };
    });
  }
  const days = period === "week" ? 7 : 30;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(range.end);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1 - i));
    const key = dayKey(d.getTime());
    const list = paid.filter((o) => dayKey(o.createdAt) === key);
    return {
      label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      revenue: list.reduce((s, o) => s + o.total, 0),
      orders: list.length,
    };
  });
}

export function buildAnalytics(input: {
  orders: Order[];
  menu: MenuItem[];
  outlets: Outlet[];
  outletId: string | "all";
  period: Period;
  now?: number;
  from?: number | undefined;
  to?: number | undefined;
}): Analytics {
  const now = input.now ?? Date.now();
  const custom = input.from != null && input.to != null;
  const range = custom ? { start: input.from!, end: input.to! } : periodRange(input.period, now);
  const inOutlet = (o: Order) => input.outletId === "all" || o.outletId === input.outletId;
  const inRange = (o: Order) => o.createdAt >= range.start && o.createdAt <= range.end;
  const real = input.orders.filter((o) => inRange(o));
  const useSample = !custom && isSparse(input.period, real);
  const source = (useSample ? sampleOrders(input.menu, input.outlets, now) : real).filter(inRange);
  const scoped = source.filter(inOutlet);
  const active = scoped.filter((o) => o.status !== "Rejected");
  const revenue = active.reduce((s, o) => s + o.total, 0);
  const phonesBefore = new Map<string, number>();
  for (const order of source) {
    const prev = phonesBefore.get(order.phone);
    if (prev == null || order.createdAt < prev) phonesBefore.set(order.phone, order.createdAt);
  }
  const newcomers = new Set<string>();
  const repeats = new Set<string>();
  for (const order of active) {
    const first = phonesBefore.get(order.phone) ?? order.createdAt;
    if (first >= range.start) newcomers.add(order.phone);
    else repeats.add(order.phone);
  }
  const byName = new Map<string, number>();
  const byCat = new Map<string, number>();
  for (const order of active) {
    for (const line of order.lines) {
      byName.set(line.name, (byName.get(line.name) ?? 0) + line.qty);
      const cat = input.menu.find((m) => m.id === line.itemId)?.category ?? "Other";
      byCat.set(cat, (byCat.get(cat) ?? 0) + line.qty);
    }
  }
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour}`,
    orders: active.filter((o) => new Date(o.createdAt).getHours() === hour).length,
  }));
  const outletRows = input.outlets.map((outlet) => {
    const list = source.filter((o) => o.outletId === outlet.id && o.status !== "Rejected");
    return {
      name: outlet.short,
      revenue: list.reduce((s, o) => s + o.total, 0),
      orders: list.length,
    };
  });

  return {
    sample: useSample,
    notice: useSample
      ? "SAMPLE year of history. There are not enough real orders for this period, so these figures are simulated and labelled as sample data."
      : null,
    revenue,
    orders: active.length,
    completed: scoped.filter((o) => o.status === "Collected").length,
    rejected: scoped.filter((o) => o.status === "Rejected").length,
    pendingPayments: scoped.filter(
      (o) =>
        o.payment === "counter" && !o.paid && o.status !== "Rejected" && o.status !== "Collected",
    ).length,
    averageOrderValue: active.length ? Math.round(revenue / active.length) : 0,
    newCustomers: newcomers.size,
    repeatCustomers: repeats.size,
    online: active.filter((o) => o.payment === "online").length,
    counter: active.filter((o) => o.payment === "counter").length,
    revenueSeries: seriesFor(custom ? "month" : input.period, scoped, range),
    byHour: hours,
    bestSellers: [...byName.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6),
    categories: [...byCat.entries()].map(([name, value]) => ({ name, value })),
    payments: [
      { name: "Online", value: active.filter((o) => o.payment === "online").length },
      { name: "Counter", value: active.filter((o) => o.payment === "counter").length },
    ],
    outlets: outletRows,
    exportRows: [
      ["number", "outlet", "status", "payment", "total", "created", "sample"],
      ...scoped.map((o) => [
        String(o.number),
        o.outletId,
        o.status,
        o.payment,
        String(o.total),
        new Date(o.createdAt).toISOString(),
        useSample ? "SAMPLE" : "live",
      ]),
    ],
  };
}
