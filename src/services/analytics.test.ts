import { describe, expect, it } from "vitest";
import { buildAnalytics } from "./analytics";
import type { MenuItem, Order, Outlet } from "./types";

const menu: MenuItem[] = [
  {
    id: "m1",
    name: "Margherita",
    description: "Tomato",
    category: "Pizzas",
    veg: true,
    price: 200,
    image: "",
    availability: { o1: true },
    priceOverride: {},
    prepMinutes: 16,
  },
];
const outlets: Outlet[] = [
  {
    id: "o1",
    name: "Outlet 1",
    short: "Outlet 1",
    address: "Madhapur",
    hours: "11-23",
    openHour: 11,
    closeHour: 23,
    mapUrl: "https://maps.google.com",
    phone: "9000000001",
    waitMinutes: 20,
    isOpen: true,
    pauseOrders: false,
  },
];

function order(
  partial: Partial<Order> & Pick<Order, "id" | "total" | "status" | "createdAt">,
): Order {
  return {
    number: 1,
    outletId: "o1",
    customerName: "A",
    phone: "9999999999",
    lines: [
      {
        key: "k",
        lineId: "ln_k",
        itemId: "m1",
        name: "Margherita",
        image: "",
        veg: true,
        toppings: [],
        unitPrice: partial.total,
        qty: 1,
        prepMinutes: 16,
        lineStatus: "queued",
      },
    ],
    subtotal: partial.total,
    tax: 0,
    discount: 0,
    pointsUsed: 0,
    pointsEarned: 0,
    payment: "online",
    paid: true,
    history: [],
    promisedAt: partial.createdAt,
    ...partial,
  };
}

describe("analytics", () => {
  it("sums live orders when the period already has enough of them", () => {
    const now = new Date("2026-10-30T18:00:00").getTime();
    const orders = [1, 2, 3].map((n) =>
      order({
        id: `o${n}`,
        total: 100 * n,
        status: "Collected",
        createdAt: now - n * 60_000,
        phone: `900000000${n}`,
      }),
    );
    const result = buildAnalytics({ orders, menu, outlets, outletId: "all", period: "today", now });
    expect(result.sample).toBe(false);
    expect(result.revenue).toBe(600);
    expect(result.orders).toBe(3);
    expect(result.completed).toBe(3);
  });

  it("fills a year with labelled sample history when real data is thin", () => {
    const result = buildAnalytics({
      orders: [],
      menu,
      outlets,
      outletId: "all",
      period: "year",
      now: new Date("2026-10-30T18:00:00").getTime(),
    });
    expect(result.sample).toBe(true);
    expect(result.notice).toMatch(/SAMPLE/);
    expect(result.revenue).toBeGreaterThan(0);
    expect(result.revenueSeries.length).toBe(12);
  });
});
