import { describe, expect, it } from "vitest";
import { liveQueue, waitForNewOrder, waitForOrder } from "./wait";
import type { Order } from "./types";

function order(partial: Partial<Order> & Pick<Order, "id" | "number" | "createdAt">): Order {
  return {
    outletId: "o1",
    customerName: "A",
    phone: "9000000000",
    lines: [],
    subtotal: 100,
    tax: 5,
    discount: 0,
    total: 105,
    pointsUsed: 0,
    pointsEarned: 0,
    payment: "counter",
    paid: false,
    status: "Placed",
    history: [],
    promisedAt: partial.createdAt,
    ...partial,
  };
}

describe("order-queue wait", () => {
  it("keeps an unpaid online order off the kitchen queue", () => {
    const q = liveQueue(
      [
        order({ id: "hold", number: 201, createdAt: 10, payment: "online", paid: false }),
        order({ id: "paid", number: 202, createdAt: 20, payment: "online", paid: true }),
        order({ id: "counter", number: 203, createdAt: 30, payment: "counter", paid: false }),
      ],
      "o1",
    );
    expect(q.map((o) => o.number)).toEqual([202, 203]);
  });

  it("puts oldest tickets first", () => {
    const q = liveQueue(
      [
        order({ id: "b", number: 102, createdAt: 20, status: "Preparing" }),
        order({ id: "a", number: 101, createdAt: 10, status: "Placed" }),
        order({ id: "c", number: 103, createdAt: 30, status: "Collected" }),
      ],
      "o1",
    );
    expect(q.map((o) => o.number)).toEqual([101, 102]);
  });

  it("gives the 6th order 60 minutes when each order is 10", () => {
    const existing = [1, 2, 3, 4, 5].map((n) =>
      order({ id: `o${n}`, number: 100 + n, createdAt: n, status: "Accepted" }),
    );
    expect(waitForNewOrder(existing, "o1", 10)).toBe(60);
  });

  it("shortens remaining wait as tickets ahead leave the queue", () => {
    const all = [1, 2, 3].map((n) =>
      order({ id: `o${n}`, number: 100 + n, createdAt: n, status: "Preparing" }),
    );
    expect(waitForOrder(all, "o1", "o3", 10)).toBe(30);
    const afterFirstDone = all.map((o) =>
      o.id === "o1" ? { ...o, status: "Collected" as const } : o,
    );
    expect(waitForOrder(afterFirstDone, "o1", "o3", 10)).toBe(20);
  });

  it("does not count ready-for-pickup tickets toward wait", () => {
    const orders = [
      order({ id: "ready", number: 100, createdAt: 1, status: "Ready" }),
      order({ id: "cook", number: 101, createdAt: 2, status: "Preparing" }),
    ];
    expect(waitForNewOrder(orders, "o1", 10)).toBe(20);
    expect(waitForOrder(orders, "o1", "ready", 10)).toBe(0);
    expect(liveQueue(orders, "o1").map((o) => o.number)).toEqual([100, 101]);
  });
});
