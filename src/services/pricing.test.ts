import { describe, expect, it } from "vitest";
import { computeBill, validateCoupon } from "./pricing";
import type { CartLine, Coupon, LoyaltyRule } from "./types";

const rule: LoyaltyRule = {
  pointsPerHundred: 10,
  steps: [{ id: "r1", points: 100, label: "Rs 50 off", type: "discount", value: 50 }],
  tiers: [{ name: "Cub", min: 0 }],
};
const step = rule.steps[0]!;
const lines: CartLine[] = [
  {
    key: "a",
    itemId: "m1",
    name: "Pie",
    image: "",
    veg: true,
    toppings: [],
    unitPrice: 1000,
    qty: 1,
  },
];
const coupon: Coupon = {
  id: "c",
  code: "SLICE10",
  type: "percent",
  value: 10,
  minOrder: 299,
  validFrom: 0,
  validUntil: 9e15,
  usageLimit: 5,
  used: 0,
  active: true,
};

describe("pricing", () => {
  it("stacks a loyalty reward, a percent coupon, tax and packaging", () => {
    const bill = computeBill(lines, rule, step, {
      taxRate: 0.05,
      packagingFee: 20,
      coupon: { type: "percent", value: 10 },
    });
    expect(bill.subtotal).toBe(1000);
    expect(bill.rewardDiscount).toBe(50);
    expect(bill.couponDiscount).toBe(95);
    expect(bill.discount).toBe(145);
    expect(bill.tax).toBe(43);
    expect(bill.packaging).toBe(20);
    expect(bill.total).toBe(918);
    expect(bill.pointsUsed).toBe(100);
    expect(bill.pointsEarned).toBe(80);
  });

  it("rejects coupons that fail the rules", () => {
    expect(validateCoupon({ ...coupon, active: false }, 1000, 10).ok).toBe(false);
    expect(validateCoupon({ ...coupon, used: 5 }, 1000, 10).ok).toBe(false);
    expect(validateCoupon(coupon, 100, 10)).toMatchObject({ ok: false });
    expect(validateCoupon({ ...coupon, validUntil: 5 }, 1000, 10).ok).toBe(false);
    expect(validateCoupon(coupon, 1000, 10)).toEqual({ ok: true });
  });
});
