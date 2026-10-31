import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Img, VegDot } from "@/components/brand";
import { Row } from "@/components/shop/Bill";
import { PageHead, ShopLayout, seo } from "@/components/shop/ShopLayout";
import { useDB, useSession } from "@/services/store";
import { applyCoupon, clearCoupon, setQty } from "@/services/api";
import { billOptions, cartSubtotal, computeBill, inr, validateCoupon } from "@/services/pricing";

export const Route = createFileRoute("/cart")({
  head: () =>
    seo("Your cart · Grizzly Pizzeria", "Review your Grizzly Pizzeria order before checkout."),
  component: CartPage,
});

function CartPage() {
  const db = useDB();
  const s = useSession();
  const step = db.loyalty.steps.find((x) => x.id === s.redeemStepId) ?? null;
  const subtotal = cartSubtotal(s.cart);
  const found = db.coupons.find((c) => c.code === s.couponCode) ?? null;
  const check = found ? validateCoupon(found, subtotal, Date.now()) : null;
  const coupon = found && check?.ok ? found : null;
  const bill = computeBill(s.cart, db.loyalty, step, billOptions(db.settings, coupon));
  const [code, setCode] = useState(s.couponCode ?? "");
  const short = Math.max(0, db.settings.minimumOrder - subtotal);
  return (
    <ShopLayout>
      <PageHead title="Your box" />
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <ul className="space-y-3">
          {s.cart.length === 0 && (
            <li className="rounded-3xl bg-card p-10 text-center shadow-warm">
              <p className="font-display text-2xl">Your box is empty.</p>
              <Button asChild className="mt-4">
                <Link to="/menu">Find something tasty</Link>
              </Button>
            </li>
          )}
          {s.cart.map((l) => (
            <li key={l.key} className="flex min-w-0 gap-3 rounded-3xl bg-card p-4 shadow-warm sm:gap-4">
              <Img src={l.image} alt={l.name} className="size-16 shrink-0 rounded-2xl sm:size-20" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <VegDot veg={l.veg} />
                  <p className="truncate font-semibold">{l.name}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {[l.size, ...l.toppings].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-full bg-muted p-1">
                    <button
                      className="grid size-11 place-items-center rounded-full bg-card"
                      onClick={() => setQty(l.key, l.qty - 1)}
                      aria-label="Decrease"
                    >
                      {l.qty === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                    </button>
                    <span className="w-7 text-center font-bold">{l.qty}</span>
                    <button
                      className="grid size-11 place-items-center rounded-full bg-card"
                      onClick={() => setQty(l.key, l.qty + 1)}
                      aria-label="Increase"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <b>{inr(l.unitPrice * l.qty)}</b>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {s.cart.length > 0 && (
          <aside className="h-fit rounded-3xl bg-card p-5 shadow-warm">
            <form
              className="mb-3 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await applyCoupon(code);
                  toast.success("Coupon applied");
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <label className="sr-only" htmlFor="coupon">
                Coupon code
              </label>
              <input
                id="coupon"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Coupon"
                className="h-11 flex-1 rounded-full border-2 border-input px-3 text-sm"
              />
              <Button type="submit" variant="secondary">
                Apply
              </Button>
            </form>
            {s.couponCode && !coupon && check && !check.ok && (
              <p className="mb-2 text-xs font-semibold text-primary">{check.reason}</p>
            )}
            {coupon && (
              <button
                type="button"
                className="mb-2 text-xs font-semibold text-primary"
                onClick={clearCoupon}
              >
                Remove {coupon.code}
              </button>
            )}
            <Row k="Subtotal" v={inr(bill.subtotal)} />
            {bill.rewardDiscount > 0 && (
              <Row k={`Reward · ${step?.label}`} v={`- ${inr(bill.rewardDiscount)}`} />
            )}
            {bill.couponDiscount > 0 && (
              <Row k={`Coupon · ${coupon?.code}`} v={`- ${inr(bill.couponDiscount)}`} />
            )}
            {bill.packaging > 0 && <Row k="Packaging" v={inr(bill.packaging)} />}
            <Row k={`GST (${db.settings.taxPercent}%)`} v={inr(bill.tax)} />
            <div className="my-3 border-t" />
            <Row k="Total" v={inr(bill.total)} bold />
            <p className="mt-2 text-sm text-muted-foreground">Earns {bill.pointsEarned} points</p>
            {short > 0 && (
              <p className="mt-2 text-sm font-semibold text-primary">
                Add {inr(short)} to reach the {inr(db.settings.minimumOrder)} minimum.
              </p>
            )}
            <Button asChild size="lg" className="mt-4 w-full">
              <Link to="/checkout">Checkout</Link>
            </Button>
          </aside>
        )}
      </div>
    </ShopLayout>
  );
}
