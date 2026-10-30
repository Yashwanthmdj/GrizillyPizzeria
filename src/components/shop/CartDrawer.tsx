import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, X, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EASE, Img, VegDot } from "@/components/brand";
import { useDB, useSession } from "@/services/store";
import { addToCart, setQty } from "@/services/api";
import {
  billOptions,
  cartSubtotal,
  computeBill,
  inr,
  itemPrice,
  validateCoupon,
} from "@/services/pricing";
import { useShopUI } from "./ui-context";

export function CartDrawer() {
  const { cartOpen, setCartOpen, flyToCart } = useShopUI();
  const db = useDB();
  const s = useSession();
  const subtotal = cartSubtotal(s.cart);
  const step = db.loyalty.steps.find((x) => x.id === s.redeemStepId) ?? null;
  const found = db.coupons.find((c) => c.code === s.couponCode) ?? null;
  const coupon = found && validateCoupon(found, subtotal, Date.now()).ok ? found : null;
  const bill = computeBill(s.cart, db.loyalty, step, billOptions(db.settings, coupon));
  const hasDrink = s.cart.some(
    (l) => db.menu.find((m) => m.id === l.itemId)?.category === "Drinks",
  );
  const upsell = db.menu
    .filter(
      (m) =>
        m.category === (hasDrink ? "Desserts" : "Drinks") &&
        (!s.outletId || m.availability[s.outletId]),
    )
    .slice(0, 3);

  useEffect(() => {
    if (!cartOpen) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [cartOpen, setCartOpen]);

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-cocoa/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
          />
          <motion.aside
            role="dialog"
            aria-label="Your cart"
            aria-modal="true"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-lift"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-2xl font-bold">Your box</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCartOpen(false)}
                aria-label="Close cart"
              >
                <X />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {s.cart.length === 0 ? (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <p className="font-display text-2xl">Empty box. Sad bear.</p>
                    <p className="mt-1 text-muted-foreground">Let's fix that.</p>
                    <Button asChild className="mt-5" onClick={() => setCartOpen(false)}>
                      <Link to="/menu">Browse menu</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence initial={false}>
                    {s.cart.map((l) => (
                      <motion.li
                        key={l.key}
                        layout
                        exit={{ opacity: 0, x: 40 }}
                        className="flex gap-3 rounded-2xl bg-card p-3 shadow-warm"
                      >
                        <Img src={l.image} alt={l.name} className="size-16 rounded-xl" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <VegDot veg={l.veg} />
                            <p className="truncate font-semibold">{l.name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {[l.size, ...l.toppings].filter(Boolean).join(" · ") || "Classic"}
                            {l.note ? ` · "${l.note}"` : ""}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1 rounded-full bg-muted p-1">
                              <button
                                className="grid size-11 place-items-center rounded-full bg-card"
                                onClick={() => setQty(l.key, l.qty - 1)}
                                aria-label="Decrease"
                              >
                                {l.qty === 1 ? (
                                  <Trash2 className="size-4" />
                                ) : (
                                  <Minus className="size-4" />
                                )}
                              </button>
                              <span
                                className="w-6 text-center text-sm font-bold"
                                aria-live="polite"
                              >
                                {l.qty}
                              </span>
                              <button
                                className="grid size-11 place-items-center rounded-full bg-card"
                                onClick={() => setQty(l.key, l.qty + 1)}
                                aria-label="Increase"
                              >
                                <Plus className="size-4" />
                              </button>
                            </div>
                            <span className="font-bold">{inr(l.unitPrice * l.qty)}</span>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
              {s.cart.length > 0 && upsell.length > 0 && (
                <div className="mt-6">
                  <p className="font-display text-lg">
                    {hasDrink ? "Something sweet?" : "Add a drink?"}
                  </p>
                  <div className="no-scrollbar mt-2 flex gap-3 overflow-x-auto pb-2">
                    {upsell.map((m) => (
                      <button
                        key={m.id}
                        className="w-32 shrink-0 rounded-2xl bg-card p-2 text-left shadow-warm transition hover:-translate-y-0.5"
                        onClick={(e) => {
                          addToCart({
                            itemId: m.id,
                            name: m.name,
                            image: m.image,
                            veg: m.veg,
                            toppings: [],
                            unitPrice: itemPrice(m, s.outletId),
                            qty: 1,
                          });
                          flyToCart(e.currentTarget, m.image);
                        }}
                      >
                        <Img src={m.image} alt={m.name} className="h-16 w-full rounded-xl" />
                        <p className="mt-1 truncate text-xs font-semibold">{m.name}</p>
                        <p className="text-xs text-primary">+ {inr(itemPrice(m, s.outletId))}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {s.cart.length > 0 && (
              <div className="border-t bg-card px-5 py-4">
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
                  <Sparkles className="size-4 text-primary" />
                  You'll earn <b>{bill.pointsEarned} pts</b>
                  {step ? (
                    <>
                      {" "}
                      · applying <b>{step.label}</b>
                    </>
                  ) : null}
                </div>
                {bill.packaging > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Packaging</span>
                    <span>{inr(bill.packaging)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>GST ({db.settings.taxPercent}%)</span>
                  <span>{inr(bill.tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{inr(bill.total)}</span>
                </div>
                <Button
                  asChild
                  size="lg"
                  className="mt-3 w-full"
                  onClick={() => setCartOpen(false)}
                >
                  <Link to="/checkout">Checkout</Link>
                </Button>
                <Link
                  to="/cart"
                  onClick={() => setCartOpen(false)}
                  className="mt-2 block text-center text-sm text-muted-foreground hover:text-primary"
                >
                  View full cart
                </Link>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
