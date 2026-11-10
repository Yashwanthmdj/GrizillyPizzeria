import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, Tag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EASE } from "@/components/brand";
import { DeliveryLinks } from "@/components/shop/DeliveryLinks";
import { useDB } from "@/services/store";
import { cn } from "@/lib/utils";

function offerLabel(code: string, type: "flat" | "percent", value: number, minOrder: number) {
  return type === "flat"
    ? `${code} · Rs ${value} off · min ${minOrder}`
    : `${code} · ${value}% off · min ${minOrder}`;
}

export function AnnouncementRail() {
  const db = useDB();
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  const offers = useMemo(() => {
    const now = Date.now();
    const live = db.coupons.filter(
      (c) => c.active && c.validFrom <= now && c.validUntil >= now && c.used < c.usageLimit,
    );
    if (live.length)
      return live.map((c) => ({
        id: c.id,
        title: c.code,
        detail: offerLabel(c.code, c.type, c.value, c.minOrder),
      }));
    return [
      {
        id: "pts",
        title: "Earn points",
        detail: `${db.loyalty.pointsPerHundred} pts per Rs 100 · free pizza waits`,
      },
      { id: "veg", title: "100% veg", detail: "No meat. No egg. Full kitchen vegetarian." },
    ];
  }, [db.coupons, db.loyalty.pointsPerHundred]);

  useEffect(() => {
    if (!open || offers.length < 2) return;
    const id = window.setInterval(() => setSlide((s) => (s + 1) % offers.length), 3400);
    return () => window.clearInterval(id);
  }, [open, offers.length]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = offers[slide % offers.length]!;

  return (
    <motion.aside
      ref={rootRef}
      aria-label="Live offers and delivery"
      className="pointer-events-none fixed right-2 top-[4.25rem] z-30 flex max-w-[calc(100vw-1rem)] flex-col items-end gap-2 sm:right-4 sm:top-[4.75rem]"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 2.1, duration: 0.5, ease: EASE }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="popup"
            role="dialog"
            aria-modal="false"
            aria-label="Coupons and delivery offers"
            className="pointer-events-auto w-[min(18.5rem,calc(100vw-1.75rem))] overflow-hidden rounded-2xl border border-cocoa/10 bg-cream text-cocoa shadow-lift"
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <div className="flex items-start justify-between gap-2 border-b border-cocoa/10 bg-secondary px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Offers</p>
                <p className="font-display text-sm leading-tight text-cocoa">Coupons &amp; delivery</p>
              </div>
              <button
                type="button"
                aria-label="Close offers"
                onClick={() => setOpen(false)}
                className="grid size-7 shrink-0 place-items-center rounded-full bg-cocoa/10 text-cocoa transition hover:bg-cocoa/15"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="px-3.5 py-3">
              <div className="relative min-h-[3.25rem] overflow-hidden rounded-xl border border-primary/20 bg-white px-3 py-2.5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="flex items-start gap-2"
                  >
                    <Tag className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold tracking-wide text-primary">
                        {current.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-cocoa/75">{current.detail}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {offers.length > 1 && (
                <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
                  {offers.map((o, i) => (
                    <span
                      key={o.id}
                      className={cn(
                        "h-1 rounded-full transition-all",
                        i === slide % offers.length ? "w-4 bg-primary" : "w-1.5 bg-cocoa/20",
                      )}
                    />
                  ))}
                </div>
              )}

              <Link
                to="/rewards"
                className="mt-2.5 inline-flex text-xs font-bold uppercase tracking-[0.14em] text-primary underline-offset-2 hover:underline"
                onClick={() => setOpen(false)}
              >
                See all rewards
              </Link>

              <div className="mt-3 border-t border-cocoa/10 pt-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-cocoa/55">
                  Order for delivery
                </p>
                <DeliveryLinks
                  alwaysShow
                  className="flex-col [&_a]:w-full [&_a]:rounded-xl [&_a]:px-3 [&_a]:py-2 [&_a]:text-xs [&_span]:w-full [&_span]:rounded-xl [&_span]:px-3 [&_span]:py-2 [&_span]:text-xs"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "pointer-events-auto flex max-w-[calc(100vw-1.25rem)] items-center gap-2 rounded-full border-2 border-cocoa bg-secondary px-2.5 py-2 text-cocoa shadow-lift sm:px-3",
          "ring-2 ring-cream/80",
        )}
        animate={
          reduce || open
            ? { y: 0 }
            : { y: [0, -8, 0] }
        }
        transition={
          reduce || open
            ? { duration: 0.2 }
            : { duration: 2.1, repeat: Infinity, ease: "easeInOut" }
        }
        whileTap={{ scale: 0.96 }}
      >
        <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="size-3.5" />
        </span>
        <span className="hidden pr-0.5 text-left leading-tight min-[380px]:block">
          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            Deals
          </span>
          <span className="block font-display text-xs">Tap for offers</span>
        </span>
        <span className="sr-only">Tap for offers</span>
      </motion.button>
    </motion.aside>
  );
}
