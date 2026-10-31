import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Gift, MapPin, QrCode, ShoppingBag, Smile } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import heroPizza from "@/assets/hero-pizza.webp";
import { Button } from "@/components/ui/button";
import { BearMark, EASE, Reveal } from "@/components/brand";
import { WelcomeCrisp } from "@/components/shop/WelcomeCrisp";
import { ShopLayout, seo } from "@/components/shop/ShopLayout";
import { MenuCard } from "@/components/shop/MenuCard";
import { OutletCard } from "@/components/shop/OutletCard";
import { useDB, useSession, useStoreReady } from "@/services/store";
import { selectOutlet } from "@/services/api";

export const Route = createFileRoute("/")({
  head: () =>
    seo(
      "Grizzly Pizzeria · 100% vegetarian pizza, Madhapur",
      "A 100% pure vegetarian kitchen. Hand-stretched pizza for pickup from two Madhapur dens — no meat, no egg, no compromise.",
    ),
  component: Home,
});

const HEADLINE = ["Big", "slices.", "Bigger", "bite."];
const TOPPINGS = ["🌿", "🍅", "🧀", "🌶️", "🍄", "🫒"];
const POINTS = [
  "100% pure vegetarian",
  "Hand-stretched daily",
  "Wood-fired flavour",
  "Skip the queue",
  "Earn points every bite",
  "Two Madhapur dens",
  "Fresh dough, made to order",
];

function ReadyNotice({
  orders,
}: {
  orders: { id: string; number: number; payment: string }[];
}) {
  const storeReady = useStoreReady();
  const seen = useRef(new Set<string>());
  const primed = useRef(false);

  useEffect(() => {
    if (!storeReady) return;
    if (!primed.current) {
      primed.current = true;
      for (const order of orders) seen.current.add(order.id);
      return;
    }
    for (const order of orders) {
      if (seen.current.has(order.id)) continue;
      seen.current.add(order.id);
      toast.success(`Your order #${order.number} is ready`);
    }
  }, [orders, storeReady]);

  if (!orders.length) return null;

  return (
    <div className="bg-secondary px-4 py-4 text-cocoa sm:px-6" role="status" aria-live="polite">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-2xl font-bold sm:text-3xl">Your order is ready</p>
          <p className="text-sm text-cocoa/80">
            {orders.length === 1
              ? `Order #${orders[0]?.number} is at the counter.`
              : `${orders.length} orders are at the counter.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {orders.map((order) => (
            <Button key={order.id} asChild>
              <Link to="/order/$id" params={{ id: order.id }}>
                {order.payment === "online" ? `Show QR · #${order.number}` : `View #${order.number}`}
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Home() {
  const db = useDB();
  const s = useSession();
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const favourites = db.menu.filter((m) => m.veg && m.badge === "Bestseller");
  const readyOrders = s.phone
    ? db.orders.filter((o) => o.phone === s.phone && o.status === "Ready")
    : [];

  return (
    <ShopLayout>
      <WelcomeCrisp />
      <ReadyNotice orders={readyOrders} />
      <section
        ref={ref}
        className="relative flex min-h-[calc(100svh-3.5rem)] items-center overflow-hidden bg-hero grain text-primary-foreground sm:min-h-[calc(100svh-4rem)]"
      >
        <div className="mx-auto grid w-full max-w-7xl items-center gap-6 px-4 py-6 sm:px-6 sm:py-8 md:grid-cols-2 md:gap-10 lg:gap-14">
          <motion.div style={{ y: y2 }} className="relative z-10 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="inline-flex items-center gap-2 rounded-full bg-primary-deep/60 px-3 py-1 text-xs font-semibold text-secondary sm:text-sm"
              >
                <BearMark className="h-5 w-auto" /> Live pickup in ~
                {Math.min(...db.outlets.map((o) => o.waitMinutes))} min
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="inline-flex items-center gap-2 rounded-full border border-secondary/50 bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary-deep sm:text-xs"
              >
                <span className="size-1.5 rounded-full bg-success" aria-hidden />
                100% Pure Veg
              </motion.p>
            </div>
            <h1 className="mt-4 text-[clamp(2.15rem,6.6vw,5.25rem)] font-bold leading-[0.95]">
              {HEADLINE.map((w, i) => (
                <motion.span
                  key={i}
                  className="mr-[0.22em] inline-block last:mr-0"
                  initial={{ opacity: 0, y: 40, rotate: -4 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ delay: 1.1 + i * 0.12, duration: 0.6, ease: EASE }}
                >
                  <span className={i >= 2 ? "text-secondary" : ""}>{w}</span>
                </motion.span>
              ))}
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.65, ease: EASE }}
              className="mt-5 flex flex-wrap items-center gap-3 text-secondary"
            >
              <span className="hidden h-px w-10 bg-secondary/70 sm:block" aria-hidden />
              <span className="font-display text-[11px] font-semibold uppercase tracking-[0.28em] sm:text-xs">
                A 100% pure vegetarian kitchen
              </span>
              <span className="hidden h-px w-10 bg-secondary/70 sm:block" aria-hidden />
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.7, ease: EASE }}
              className="mt-3 max-w-md text-base text-primary-foreground/85 sm:text-lg"
            >
              No meat. No egg. No shared fryer. Order ahead, skip the queue, walk out with a box of
              joy.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.85, ease: EASE }}
              className="mt-5 flex flex-wrap gap-3 sm:mt-7"
            >
              <Button
                variant="hero"
                size="lg"
                onClick={() => nav({ to: s.outletId ? "/menu" : "/outlets" })}
              >
                Order now <ArrowRight />
              </Button>
              <Button variant="heroOutline" size="lg" asChild>
                <Link to="/outlets">
                  <MapPin />{" "}
                  {s.outletId
                    ? db.outlets.find((o) => o.id === s.outletId)?.short
                    : "Choose outlet"}
                </Link>
              </Button>
            </motion.div>
          </motion.div>
          <motion.div
            style={{ y: y1 }}
            className="relative mx-auto size-[min(18rem,70vw)] sm:size-[min(22rem,55vw)] md:size-[min(28rem,_36vw,_calc(100svh-12rem))] lg:size-[min(30rem,_34vw,_calc(100svh-12rem))]"
          >
            <div className="absolute inset-[8%] rounded-full bg-primary-deep/50 blur-2xl" />
            <motion.img
              src={heroPizza}
              alt="Grizzly Pizzeria pizza"
              width={720}
              height={720}
              fetchPriority="high"
              className="relative size-full object-contain drop-shadow-2xl"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={reduce ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1, rotate: 360 }}
              transition={{
                scale: { duration: 0.9, ease: EASE, delay: 1 },
                opacity: { duration: 0.6, delay: 1 },
                rotate: { duration: 60, repeat: Infinity, ease: "linear" },
              }}
            />
            {!reduce &&
              TOPPINGS.map((t, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="absolute text-2xl sm:text-3xl md:text-4xl"
                  style={{
                    left: `${[8, 82, 10, 84, 48, 68][i]}%`,
                    top: `${[8, 12, 78, 72, 4, 86][i]}%`,
                  }}
                  animate={{ y: [0, -14, 0], rotate: [0, 12, 0] }}
                  transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  {t}
                </motion.span>
              ))}
          </motion.div>
        </div>
      </section>

      <div
        className="relative w-full max-w-full overflow-hidden border-y-4 border-primary-deep bg-secondary py-3 text-primary-deep"
        aria-hidden
      >
        <div className="marquee flex w-max max-w-none gap-10 whitespace-nowrap font-display text-xl font-semibold will-change-transform">
          {[...POINTS, ...POINTS].map((p, i) => (
            <span key={i} className="flex items-center gap-10">
              {p} <span className="text-primary">✦</span>
            </span>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Reveal className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-widest text-primary">
              Crowd favourites
            </p>
            <h2 className="text-3xl font-bold sm:text-5xl">The bear's best</h2>
          </div>
          <Link
            to="/menu"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:text-base"
          >
            Full menu <ArrowRight className="size-4" />
          </Link>
        </Reveal>
        <div className="no-scrollbar -mx-4 mt-8 flex snap-x gap-5 overflow-x-auto px-4 pb-4">
          {favourites.map((m, i) => (
            <div key={m.id} className="w-[min(18rem,calc(100vw-3rem))] shrink-0 snap-start sm:w-72">
              <MenuCard item={m} outletId={s.outletId} index={i} />
            </div>
          ))}
        </div>
      </section>

      <section className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
              From our kitchen
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-5xl">A purely vegetarian table.</h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Every pizza, sandwich, bread and dip is made in a 100% vegetarian kitchen — the way
              this den was always meant to be.
            </p>
            <ul className="mx-auto mt-10 grid max-w-3xl gap-4 text-left sm:grid-cols-3">
              {[
                { t: "No meat", d: "Not on the board. Not in the fryer. Not a maybe." },
                { t: "No egg", d: "Dough, sauces and breads are made without egg." },
                { t: "No compromise", d: "The full kitchen is vegetarian, every hour we are open." },
              ].map((x) => (
                <li
                  key={x.t}
                  className="rounded-3xl border border-border bg-background px-5 py-6 shadow-warm"
                >
                  <p className="font-display text-lg text-primary">{x.t}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="bg-muted py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <h2 className="text-center text-3xl font-bold sm:text-5xl">How it works</h2>
          </Reveal>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: MapPin, t: "Choose outlet", d: "Pick the den nearest you." },
              { icon: ShoppingBag, t: "Order", d: "Build your box, pay online or at the counter." },
              {
                icon: QrCode,
                t: "Collect",
                d: "When the kitchen marks it ready, online orders get a QR. Counter orders use the number.",
              },
              { icon: Smile, t: "Enjoy", d: "Eat. Earn points. Repeat." },
            ].map((x, i) => (
              <Reveal key={x.t} delay={i * 0.1}>
                <li className="relative h-full rounded-3xl bg-card p-6 shadow-warm">
                  <span className="absolute right-5 top-4 font-display text-5xl text-muted">
                    {i + 1}
                  </span>
                  <motion.span
                    whileHover={{ rotate: -10, scale: 1.1 }}
                    className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground"
                  >
                    <x.icon className="size-6" />
                  </motion.span>
                  <h3 className="mt-4 text-xl font-bold">{x.t}</h3>
                  <p className="mt-1 text-muted-foreground">{x.d}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-cocoa p-8 text-cream shadow-lift sm:p-12">
            <BearMark className="absolute -bottom-6 right-4 h-48 w-auto opacity-25 sm:h-64" />
            <Gift className="size-10 text-secondary" />
            <h2 className="mt-4 max-w-lg text-3xl font-bold sm:text-5xl">
              Every bite earns points.
            </h2>
            <p className="mt-3 max-w-md text-cream/75">
              {db.loyalty.pointsPerHundred} points per Rs 100. Hit {db.loyalty.steps.at(-1)?.points}{" "}
              and the next {db.loyalty.steps.at(-1)?.label.toLowerCase()} is on us.
            </p>
            <Button variant="hero" className="mt-6" asChild>
              <Link to="/rewards">See my rewards</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Reveal>
          <h2 className="text-3xl font-bold sm:text-5xl">Find a den</h2>
        </Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {db.outlets.map((o, i) => (
            <Reveal key={o.id} delay={i * 0.1}>
              <OutletCard
                outlet={o}
                orders={db.orders}
                selected={s.outletId === o.id}
                onSelect={() => {
                  selectOutlet(o.id);
                  nav({ to: "/menu" });
                }}
              />
            </Reveal>
          ))}
        </div>
      </section>
    </ShopLayout>
  );
}
