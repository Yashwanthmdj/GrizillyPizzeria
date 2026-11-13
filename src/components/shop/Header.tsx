import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, MapPin, ShoppingBag, Menu as MenuIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EASE, Logo } from "@/components/brand";
import { useDB, useSession } from "@/services/store";
import { selectOutlet } from "@/services/api";
import { canOrder } from "@/services/outlet-status";
import { useShopUI } from "./ui-context";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/menu", label: "Menu" },
  { to: "/outlets", label: "Outlets" },
  { to: "/orders", label: "My orders" },
  { to: "/rewards", label: "Rewards" },
  { to: "/contact", label: "Contact" },
] as const;

function OutletSelect({
  className,
  useFullName = false,
}: {
  className?: string;
  useFullName?: boolean;
}) {
  const db = useDB();
  const session = useSession();
  return (
    <label className={cn("relative block w-full", className)}>
      <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary" />
      <span className="sr-only">Choose outlet</span>
      <select
        value={session.outletId ?? ""}
        onChange={(e) => selectOutlet(e.target.value)}
        className="h-11 w-full appearance-none rounded-xl border-0 bg-primary-deep py-0 pl-9 pr-10 text-sm font-semibold text-secondary outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
      >
        <option value="" disabled>
          Pick outlet
        </option>
        {db.outlets.map((o) => (
          <option key={o.id} value={o.id}>
            {useFullName ? o.name : o.short}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-secondary"
        aria-hidden
      />
    </label>
  );
}

function placeLabel(address: string) {
  const parts = address.split(",").map((part) => part.trim());
  return parts[1] || parts[0] || "Outlet";
}

function MobileOutletPicker({
  open,
  onToggle,
  onClose,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const db = useDB();
  const session = useSession();
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const current = db.outlets.find((o) => o.id === session.outletId);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open, onClose]);

  return (
    <div ref={root} className="relative flex min-w-0 flex-1 justify-center sm:hidden">
      <button
        type="button"
        className="flex h-9 max-w-full items-center gap-1 rounded-full bg-primary-deep px-2.5 text-xs font-semibold text-secondary"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={current ? `Outlet, ${current.short}` : "Choose an outlet"}
        onClick={onToggle}
      >
        <MapPin className="size-3.5 shrink-0" />
        <span className="truncate">{current ? current.short : "Outlet"}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Choose outlet"
            className="absolute top-[calc(100%+0.45rem)] left-1/2 z-50 w-max min-w-[11.5rem] -translate-x-1/2 rounded-2xl bg-primary-deep p-1 shadow-warm"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.28, ease: EASE }}
          >
            {db.outlets.map((o) => {
              const selected = session.outletId === o.id;
              const openNow = canOrder(o);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      selectOutlet(o.id);
                      onClose();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left active:scale-[0.98]",
                      selected ? "bg-secondary text-cocoa" : "text-cream",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{placeLabel(o.address)}</span>
                      <span className={cn("block text-[11px]", selected ? "text-cocoa/70" : "text-cream/65")}>
                        {o.short}
                        {" · "}
                        {openNow ? `~${o.waitMinutes} min` : o.pauseOrders ? "Paused" : "Closed"}
                      </span>
                    </span>
                    {selected && <Check className="size-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Header() {
  const session = useSession();
  const { setCartOpen, bump } = useShopUI();
  const [open, setOpen] = useState(false);
  const [outletOpen, setOutletOpen] = useState(false);
  const count = session.cart.reduce((s, l) => s + l.qty, 0);

  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-warm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-1.5 px-3 sm:h-16 sm:gap-3 sm:px-6">
        <Link
          to="/"
          className="block h-8 w-[7.25rem] shrink-0 overflow-hidden sm:h-10 sm:w-auto"
          aria-label="Grizzly Pizzeria home"
        >
          <Logo className="h-full max-w-full" />
        </Link>
        <MobileOutletPicker
          open={outletOpen}
          onToggle={() => {
            setOutletOpen((v) => !v);
            setOpen(false);
          }}
          onClose={() => setOutletOpen(false)}
        />
        <span className="hidden shrink-0 rounded-full border border-secondary/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-secondary sm:inline-flex">
          100% Veg
        </span>
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-primary-foreground/85 transition hover:bg-primary-deep hover:text-primary-foreground"
              activeOptions={{ exact: n.to !== "/menu" }}
              activeProps={{ className: "bg-primary-deep text-secondary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:ml-auto sm:gap-2">
          <OutletSelect className="relative hidden w-auto min-w-[9.5rem] sm:block [&_select]:h-10 [&_select]:rounded-full [&_select]:border-2 [&_select]:border-secondary/40" />
          <Link
            to="/account"
            className="hidden h-11 items-center rounded-full px-3 text-sm font-semibold hover:bg-primary-deep sm:inline-flex"
            activeProps={{ className: "bg-primary-deep text-secondary" }}
          >
            {session.phone ? session.customerName?.split(/\s+/)[0] || "Account" : "Sign in"}
          </Link>
          <button
            id="cart-target"
            onClick={() => setCartOpen(true)}
            className="relative grid size-10 place-items-center rounded-full bg-secondary text-primary-deep transition hover:scale-105 active:scale-95 sm:size-11"
            aria-label={`Open cart, ${count} items`}
          >
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <motion.span
                key={bump + count}
                initial={{ scale: 0.4 }}
                animate={{ scale: [1.5, 1] }}
                transition={{ type: "spring", stiffness: 500, damping: 12 }}
                className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-cocoa px-1 text-[11px] font-bold text-cream"
              >
                {count}
              </motion.span>
            )}
          </button>
          <button
            className="grid size-10 place-items-center rounded-full md:hidden sm:size-11"
            onClick={() => {
              setOpen((v) => !v);
              setOutletOpen(false);
            }}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X /> : <MenuIcon />}
          </button>
        </div>
      </div>
      <motion.nav
        initial={false}
        animate={{ height: open ? "auto" : 0 }}
        className={cn("overflow-hidden md:hidden")}
        aria-label="Mobile"
      >
        <div className="flex flex-col gap-1 px-4 pb-4">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-xl px-3 py-3 font-semibold hover:bg-primary-deep"
              activeOptions={{ exact: n.to !== "/menu" }}
              activeProps={{ className: "bg-primary-deep text-secondary" }}
            >
              {n.label}
            </Link>
          ))}
          <Link
            to="/account"
            onClick={() => setOpen(false)}
            className="min-h-11 rounded-xl px-3 py-3 font-semibold hover:bg-primary-deep"
            activeProps={{ className: "bg-primary-deep text-secondary" }}
          >
            {session.phone ? session.customerName?.split(/\s+/)[0] || "Account" : "Sign in"}
          </Link>
        </div>
      </motion.nav>
    </header>
  );
}
