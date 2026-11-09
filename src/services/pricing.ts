import type {
  CartLine,
  Coupon,
  LoyaltyRule,
  MenuItem,
  RewardStep,
  ShopSettings,
  SizeKey,
} from "./types";

export const TAX_RATE = 0.05;

export function itemPrice(item: MenuItem, outletId: string | null) {
  return (outletId && item.priceOverride[outletId]) || item.price;
}

export function unitPrice(
  item: MenuItem,
  outletId: string | null,
  size: SizeKey | undefined,
  toppings: string[],
) {
  const base = itemPrice(item, outletId);
  const sizeExtra = item.sizes?.find((s) => s.key === size)?.extra ?? 0;
  const tops = (item.toppings ?? [])
    .filter((t) => toppings.includes(t.name))
    .reduce((s, t) => s + t.price, 0);
  return base + sizeExtra + tops;
}

/** Server-side prices. Client unit prices are ignored. */
export function repriceLines(lines: CartLine[], menu: MenuItem[], outletId: string): CartLine[] {
  if (!lines.length) throw new Error("Your box is empty.");
  return lines.map((line) => {
    const item = menu.find((entry) => entry.id === line.itemId);
    if (!item) throw new Error("An item in your box is no longer on the menu.");
    if (item.availability[outletId] === false) {
      throw new Error(`${item.name} isn't available at this outlet.`);
    }
    const qty = Math.round(Number(line.qty));
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new Error("Check the quantity on your order.");
    const known = new Set((item.toppings ?? []).map((topping) => topping.name));
    const toppings = (line.toppings ?? []).filter((name) => known.has(name));
    const size = line.size && item.sizes?.some((option) => option.key === line.size) ? line.size : undefined;
    const { size: _ignored, ...rest } = line;
    return {
      ...rest,
      name: item.name,
      image: item.image,
      veg: true,
      ...(size ? { size } : {}),
      toppings,
      unitPrice: unitPrice(item, outletId, size, toppings),
      qty,
      prepMinutes: line.prepMinutes || item.prepMinutes,
    };
  });
}

export function cartSubtotal(lines: CartLine[]) {
  return lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
}

export function rewardDiscount(step: RewardStep | null | undefined, subtotal: number) {
  if (!step) return 0;
  return Math.min(step.value, subtotal);
}

export function pointsFor(amount: number, rule: LoyaltyRule) {
  return Math.floor(Math.max(0, amount) / 100) * rule.pointsPerHundred;
}

export type CouponCheck = { ok: true } | { ok: false; reason: string };

export function validateCoupon(coupon: Coupon, subtotal: number, now: number): CouponCheck {
  if (!coupon.active) return { ok: false, reason: "This coupon is turned off." };
  if (now < coupon.validFrom) return { ok: false, reason: "This coupon is not active yet." };
  if (now > coupon.validUntil) return { ok: false, reason: "This coupon has expired." };
  if (coupon.used >= coupon.usageLimit)
    return { ok: false, reason: "This coupon has reached its usage limit." };
  if (subtotal < coupon.minOrder) {
    const more = Math.ceil(coupon.minOrder - subtotal);
    return {
      ok: false,
      reason: `Add Rs ${more.toLocaleString("en-IN")} more to use ${coupon.code}.`,
    };
  }
  if (coupon.type === "percent" && (coupon.value <= 0 || coupon.value > 90)) {
    return { ok: false, reason: "This coupon is misconfigured." };
  }
  if (coupon.type === "flat" && coupon.value <= 0)
    return { ok: false, reason: "This coupon is misconfigured." };
  return { ok: true };
}

export function couponAmount(
  coupon: { type: Coupon["type"]; value: number } | null | undefined,
  afterReward: number,
) {
  if (!coupon || afterReward <= 0) return 0;
  const raw =
    coupon.type === "percent" ? Math.round((afterReward * coupon.value) / 100) : coupon.value;
  return Math.min(Math.max(0, raw), afterReward);
}

export interface BillOptions {
  taxRate?: number;
  packagingFee?: number;
  coupon?: { type: Coupon["type"]; value: number } | null;
}

export interface Bill {
  subtotal: number;
  discount: number;
  rewardDiscount: number;
  couponDiscount: number;
  packaging: number;
  tax: number;
  total: number;
  pointsUsed: number;
  pointsEarned: number;
}

export function billOptions(settings: ShopSettings, coupon: Coupon | null): BillOptions {
  return {
    taxRate: settings.taxPercent / 100,
    packagingFee: settings.packagingFee,
    coupon: coupon ? { type: coupon.type, value: coupon.value } : null,
  };
}

export function computeBill(
  lines: CartLine[],
  rule: LoyaltyRule,
  step: RewardStep | null,
  options?: BillOptions,
): Bill {
  const subtotal = cartSubtotal(lines);
  const reward = rewardDiscount(step, subtotal);
  const afterReward = Math.max(0, subtotal - reward);
  const couponOff = couponAmount(options?.coupon, afterReward);
  const discount = reward + couponOff;
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(taxable * (options?.taxRate ?? TAX_RATE));
  const packaging = Math.max(0, options?.packagingFee ?? 0);
  const total = taxable + tax + packaging;
  return {
    subtotal,
    discount,
    rewardDiscount: reward,
    couponDiscount: couponOff,
    packaging,
    tax,
    total,
    pointsUsed: step?.points ?? 0,
    pointsEarned: pointsFor(taxable, rule),
  };
}

export function tierFor(lifetime: number, rule: LoyaltyRule) {
  const tiers = [...rule.tiers].sort((a, b) => a.min - b.min);
  let idx = 0;
  tiers.forEach((t, i) => {
    if (lifetime >= t.min) idx = i;
  });
  return { current: tiers[idx] ?? { name: "Cub", min: 0 }, next: tiers[idx + 1] ?? null };
}

export const inr = (n: number) => `Rs ${Math.round(n).toLocaleString("en-IN")}`;
