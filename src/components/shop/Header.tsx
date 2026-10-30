import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MapPin, ShoppingBag, Menu as MenuIcon, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/brand";
import { useDB, useSession } from "@/services/store";
import { selectOutlet } from "@/services/api";
import { useShopUI } from "./ui-context";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/menu", label: "Menu" },
  { to: "/outlets", label: "Outlets" },
  { to: "/orders", label: "My orders" },
  { to: "/rewards", label: "Rewards" },
  { to: "/contact", label: "Contact" },
] as const;

export function Header() {
  const db = useDB();
  const session = useSession();
  const { setCartOpen, bump } = useShopUI();
  const [open, setOpen] = useState(false);
  const count = session.cart.reduce((s, l) => s + l.qty, 0);

  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-warm">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="h-9 shrink-0 sm:h-10" aria-label="Grizzly Pizzeria home">
          <Logo className="h-full" />
        </Link>
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
        <div className="ml-auto flex items-center gap-2">
          <label className="relative hidden items-center sm:flex">
            <MapPin className="pointer-events-none absolute left-3 size-4 text-secondary" />
            <span className="sr-only">Choose outlet</span>
            <select
              value={session.outletId ?? ""}
              onChange={(e) => selectOutlet(e.target.value)}
              className="h-10 appearance-none rounded-full border-2 border-secondary/40 bg-primary-deep pl-9 pr-4 text-sm font-semibold text-secondary outline-none focus-visible:border-secondary"
            >
              <option value="" disabled>
                Pick outlet
              </option>
              {db.outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.short}
                </option>
              ))}
            </select>
          </label>
          <Link
            to="/account"
            className="hidden h-11 items-center rounded-full px-3 text-sm font-semibold hover:bg-primary-deep sm:inline-flex"
            activeProps={{ className: "bg-primary-deep text-secondary" }}
          >
            {session.phone ? "Account" : "Sign in"}
          </Link>
          <button
            id="cart-target"
            onClick={() => setCartOpen(true)}
            className="relative grid size-11 place-items-center rounded-full bg-secondary text-primary-deep transition hover:scale-105 active:scale-95"
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
            className="grid size-11 place-items-center rounded-full md:hidden"
            onClick={() => setOpen((v) => !v)}
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
            {session.phone ? "Account" : "Sign in"}
          </Link>
          <select
            value={session.outletId ?? ""}
            onChange={(e) => selectOutlet(e.target.value)}
            className="mt-2 h-11 rounded-xl bg-primary-deep px-3 font-semibold text-secondary"
            aria-label="Choose outlet"
          >
            <option value="" disabled>
              Pick outlet
            </option>
            {db.outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </motion.nav>
    </header>
  );
}
